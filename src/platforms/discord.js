const { Client, MessageMentions } = require('discord.js')
const { BasePlatform } = require('../utils')
const { once } = require('events')

const EMOJI_PATTERN = /<(a?:\w+:)(\d+)>/g
const TO_ANY_PATTERN = /(:\w+:)/g

module.exports = class Discord extends BasePlatform {
  get tagName () { return 'discord' }
  get idName () { return 'DS' }

  constructor ({ clientId, guildId, token, activity = {} }) {
    super()
    this.client = new Client({
      presence: {
        status: 'online',
        activity: {
          ...activity,
          application: clientId
        }
      }
      // ws: {
      //   intents: ["GUILD_MESSAGES", "GUILD_MESSAGE_TYPING", "GUILD_MESSAGE_REACTIONS"]
      // }
    })
    this.login = this.client.login.bind(this.client, token)
    this.selfID = ''
  }

  async start () {
    await this.login()
    this.selfID = this.client.user.id
    await once(this.client, 'ready')
  }

  async stop () {
    this.login = null
    this.client.destroy()
    this.client = null
  }

  on (name, func) {
    this.client.on(({
      send: 'message',
      edit: 'messageUpdate',
      remove: 'messageDelete'
    })[name], async (msg, msgNew) => {
      if (!msg.guild || msg.author.id === this.selfID) return
      const bridgeId = this.createId(msg.channel.id, msg.id)
      const bridgeMessage = await this.toMessage(msgNew || msg)
      func(bridgeId, bridgeMessage)
    })
    return this
  }

  async send (chatId, message) {
    const channel = await this.client.channels.fetch(chatId)
    const msg = await channel.send(message.replace(TO_ANY_PATTERN, '<$&>'))
    return this.createId(chatId, msg.id)
  }

  async edit ([chatId, messageId], message) {
    const channel = await this.client.channels.fetch(chatId)
    const msg = await channel.messages.fetch(messageId)
    if (!msg.editable) throw new Error('Unable to edit')
    await msg.edit(message.replace(TO_ANY_PATTERN, '<$&>'))
  }

  async remove ([chatId, messageId]) {
    const channel = await this.client.channels.fetch(chatId)
    const msg = await channel.messages.fetch(messageId)
    if (!msg.deletable) throw new Error('Unable to delete')
    await msg.delete()
  }

  mentionsToText (mentions, text) {
    if (mentions.channels.size) {
      text = text.replace(MessageMentions.CHANNELS_PATTERN, (_, id) => `#${mentions.channels.get(id).name}`)
    }
    if (mentions.roles.size) {
      text = text.replace(MessageMentions.ROLES_PATTERN, (_, id) => `@${mentions.roles.get(id).name}`)
    }
    if (mentions.members.size) {
      text = text.replace(MessageMentions.USERS_PATTERN, (_, id) => `@${mentions.members.get(id).displayName}`)
    }
    if (EMOJI_PATTERN.test(text)) {
      text = text.replace(EMOJI_PATTERN, '$1')
    }
    return text
  }

  async toMessage (msg) {
    if (msg.deleted) return ''
    let text = this.tag(msg.author.tag.replace('#', ' #'))
    if (msg.content.startsWith('>')) { text += '\n' }
    text += msg.content
    if (msg.reference) {
      const { channelID, messageID } = msg.reference
      try {
        const channel = await this.client.channels.fetch(channelID)
        const reference = await channel.messages.fetch(messageID)
        text += '\n' + this.greentext(await toMessage(reference))
      } catch {}
    }
    
    if (msg.attachments.size) {
      text += '\n' + this.greentext(Array.from(msg.attachments.values(), v => v.url).join('\n'))
    }
    return this.mentionsToText(msg.mentions, text)
  }
}
