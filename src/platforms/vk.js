const { VK: Client } = require('vk-io')
const { BasePlatform } = require('../utils.js')

const URL_PATTERN = /https?:\/\/.+\.(png|jpg)/g
const EVERYONE_PATTERN = /^[^>]*@(all|everyone)/g
const HERE_PATTERN = /^[^>]*@(online|here)/g

module.exports = class VK extends BasePlatform {
  get tagName () { return 'vk' }
  get idName () { return 'VK' }

  constructor ({ token, userId, groupId, userAgent = 'MIEFoudation/Bridge (+https://github.com/MIEFoundation/Bridge)' }) {
    super()
    this.client = new Client({
      token,
      language: 'ru',
      apiMode: 'parallel',
      // apiVersion: 5.101,
      apiHeaders: { 'User-Agent': userAgent },
      ...(groupId ? { pollingGroupId: groupId } : {})
    })
    this.api = this.client.api
    this.groupId = groupId | 0
    this.userId = 0
    this.userCache = new Map()
    this.client.updates.on(['new_message', 'edit_message', 'messages_delete'], async (ctx, next) => {
      await ctx.loadMessagePayload()
      if ((this.groupId ? ctx.payload.admin_author_id : ctx.senderId) === this.userId) return
      let id = ctx.id
      if (!id) {
        const { items: [msg] } = await this.api.messages.getByConversationMessageId({
          peer_id: ctx.peerId,
          ...(this.groupId ? { group_id: this.groupId } : {}),
          conversation_message_ids: ctx.conversationMessageId
        })
        id = msg.id
      }
      ctx.bridgeId = this.createId(ctx.peerId, id)
      ctx.bridgeMessage = await this.toMessage(ctx)
      next()
    })
  }

  async start () {
    const [{ id }] = await this.api.users.get()
    this.userId = id
    await this.client.updates.startPolling()
  }

  async stop () {
    this.client = await this.client.updates.stop()
    this.api = null
  }

  on (name, func) {
    this.client.updates.on(({
      send: 'new_message',
      edit: 'edit_message',
      remove: 'messages_delete'
    })[name], async (ctx, next) => {
      func(ctx.bridgeId, ctx.bridgeMessage)
      next()
    })
    return this
  }

  async upload (peerId, message) {
    if (!URL.test(message)) return []
    const values = message.match(URL_PATTERN).map(value => ({ value }))
    return this.client.upload.messagePhoto({ source: { values }, peer_id: peerId })
  }

  async send (peerId, message) {
    return this.createId(peerId, await this.api.messages.send({
      peer_id: peerId,
      message,
      disable_mentions: +(!message.includes('@everyone') && !message.includes('@here')),
      random_id: Math.random().toString().substring(2),
      // attachments: await this.upload(peerId, message)
      ...(this.groupId ? { group_id: this.groupId } : {})
    }))
  }

  async edit ([peerId, msgId], message) {
    return (await this.api.messages.edit({
      peer_id: peerId,
      message,
      message_id: msgId,
      ...(this.groupId ? { group_id: this.groupId } : {})
    })) === 1
  }

  async remove ([_, msgIds]) {
    return (await this.api.messages.delete({
      message_ids: msgIds,
      delete_for_all: 1,
      ...(this.groupId ? { group_id: this.groupId } : {})
    }))[`${msgIds}`] === 1
  }

  async getUser (id) {
    if (this.userCache.has(id)) return this.userCache.get(id)
    const [user] = await (
      id > 0
        ? this.api.users.get({ user_ids: id, fields: 'screen_name' })
        : this.api.groups.getById({ group_id: -id, fields: 'screen_name' })
    )
    this.userCache.set(id, user)
    return user
  }

  attachmentToUrl (v) {
    switch (v.type) {
      case 'photo': return v.sizes.sort((a, b) => b.width - a.width)[0].url
      case 'audio_message': return `[Аудиосообщение] ${v.url}`
      case 'audio':
      case 'link':
        return `${v.isHq ? '[HD] ' : ''}[${v.artist} - ${v.title}] ${v.url}`
      case 'video':
        return `${v.isBroadcast ? '[LIVE] ' : ''}[${v.title}] https://vk.com/video${v.ownerId}_${v.id}`
      case 'wall': return `[Запись на стене] https://vk.com/${v}`
      case 'graffiti': return `[Граффити] ${v.url}`
      case 'market': return `[Товар] https://vk.com/market?w=product${v.ownerId}_${v.id}`
      case 'poll': return `[Опрос] https://vk.com/${v}`
      case 'sticker': return `[Стикер] https://vk.com/sticker/1-${v.id}-128`
      case 'story': return `[Сторис] https://vk.com/${v}`
      case 'gift': return '[Подарок ВК]'
      case 'market_album': return '[Товары ВК]'
      case 'wall_reply': return '[Комментарий на стене]'
      default:
        return `${v.url || (v.toString().startsWith('[') ? '[Какая-то хуйня]' : ('https://vk.com/' + v))}`
    }
  }

  async toMessage (ctx) {
    if (ctx.isRemoved) return
    if (ctx.loadMessagePayload) {
      await ctx.loadMessagePayload(true)
    }
    if (-ctx.senderId === this.groupId || ctx.senderId === this.userId) {
      return this.greentext(ctx.text)
    }
    const {
      first_name: fName,
      last_name: lName,
      screen_name: nickname,
      name = ''
    } = await this.getUser(ctx.senderId)
    let text = this.tag(nickname, name || `${fName} ${lName}`)
    if (ctx.hasText) {
      if (ctx.text.startsWith('>')) { text += '\n' }
      text += ctx.text
    }
    if (ctx.attachments.length) {
      for (const msg of ctx.attachments) {
        text += '\n' + this.greentext(this.attachmentToUrl(msg))
      }
    }
    if (ctx.hasReplyMessage) {
      text += '\n' + this.greentext(await this.toMessage(ctx.replyMessage))
    }
    if (ctx.hasForwards) {
      for (const msg of ctx.forwards) {
        text += '\n' + this.greentext(await this.toMessage(msg))
      }
    }
    if (EVERYONE_PATTERN.test(text)) {
      text = text.replace(EVERYONE_PATTERN, '@everyone')
    }
    if (HERE_PATTERN.test(text)) {
      text = text.replace(HERE_PATTERN, '@here')
    }
    return text
  }
}
