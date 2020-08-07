const { Client, MessageEmbed } = require("discord.js")
const { BasePlatform } = require("../utils")
const { once } = require('events')

module.exports = class Discord extends BasePlatform {
	get tagName () { return 'discord' }
	get idName () { return 'DS' }
	
	constructor ({ clientId, guildId, token, activity = {} }) {
		super()
		this.client = new Client({
			fetchAllMembers: true,
			disableMentions: "all",
			allowedMentions: { parse: ["everyone"] },
			presence: {
				status: "online",
				activity: {
					...activity,
					application: clientId
				}
			},
			//ws: {
			//	intents: ["GUILD_MESSAGES", "GUILD_MESSAGE_TYPING", "GUILD_MESSAGE_REACTIONS"]
			//}
		})
		this.login = () => this.client.login(token)
		this.guildId = guildId
		this.selfID = clientId
	}
	
	async start () {
		await this.login()
		await once(this.client, 'ready')
	}
	
	on (name, func) {
		this.client.on(({
			send: "message",
			edit: "messageUpdate",
			remove: "messageDelete"
		})[name], async (msg, msgNew) => {
			if (!msg.guild || msg.guild.id !== this.guildId || msg.author.id === this.selfID) return
			const bridgeId = this.createId(msg.channel.id, msg.id)
			const bridgeMessage = this.toMessage(msgNew || msg)
			func(bridgeId, bridgeMessage)
		})
		return this
	}
	
	async send (chatId, message) {
		const channel = await this.client.channels.fetch(chatId)
		channel.startTyping()
		const msg = await channel.send(message)
		channel.stopTyping()
		return this.createId(chatId, msg.id)
	}
	
	async edit ([ chatId, messageId ], message) {
		const channel = await this.client.channels.fetch(chatId)
		const msg = await channel.messages.fetch(messageId)
		if (!msg.editable) return false
		await msg.edit(message)
		return true
	}
	
	async remove ([ chatId, messageId ]) {
		const channel = await this.client.channels.fetch(chatId)
		const msg = await channel.messages.fetch(messageId)
		if (!msg.deletable) return false
		await msg.delete()
		return true
	}
	
	toMessage (msg) {
		if (msg.deleted) return
		if (msg.author.id === this.selfId) return this.greentext(msg)
		let text = this.tag(msg.author.tag.replace('#', ' #'))
		text += (msg.content.startsWith(">") ? "\n" : "") + msg.content
		if (msg.attachments.size) {
			text += this.greentext(Array.from(msg.attachments, v => v.url).join('\n'))
		}
		return text
	}
}
