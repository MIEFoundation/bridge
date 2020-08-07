const { VK: Client } = require("vk-io")
const { BasePlatform } = require("../utils.js")

module.exports = class VK extends BasePlatform {
	get tagName () { return 'vk' }
	get idName () { return 'VK' }
	
	constructor ({ token, userId, groupId, userAgent }) {
		super()
		this.client = new Client({
			token,
			language: "ru",
			apiMode: "parallel",
			// apiVersion: 5.101,
			apiHeaders: { "User-Agent": userAgent },
			...(groupId ? { pollingGroupId: groupId } : {})
		})
		this.api = this.client.api
		if (groupId) {
			this.groupId = groupId
		} else {
			this.userId = userId
		}
		this.userCache = new Map()
		this.client.updates.on(['new_message', 'edit_message', 'messages_delete'], async (ctx, next) => {
			await ctx.loadMessagePayload()
			let id = ctx.id
			if (this.groupId) {
				if (-ctx.senderId === this.groupId) return
				if (!id) {
					const { items: [ msg ] } = await this.api.messages.getByConversationMessageId({
						peer_id: ctx.peerId,
						group_id: this.groupId,
						conversation_message_ids: ctx.conversationMessageId
					})
					id = msg.id
				}
			} else if (ctx.senderId === this.userId) return
			ctx.bridgeId = this.createId(ctx.peerId, id)
			ctx.bridgeMessage = await this.toMessage(ctx)
			next()
		})
	}
	
	async start () {
		await this.client.updates.startPolling()
	}
	
	on (name, func) {
		this.client.updates.on(({
			send: "new_message",
			edit: "edit_message",
			remove: "messages_delete"
		})[name], async (ctx, next) => {
			func(ctx.bridgeId, ctx.bridgeMessage)
			next()
		})
		return this
	}
	
	async send (peer_id, message) {
		return this.createId(peer_id, await this.api.messages.send({
			peer_id,
			message,
			disable_mentions: 1,
			random_id: Math.random().toString().substring(2),
			...(this.groupId ? { group_id: this.groupId } : {})
		}))
	}
	
	async edit ([ peer_id, message_id ], message) {
		return (await this.api.messages.edit({
			peer_id,
			message,
			message_id,
			...(this.groupId ? { group_id: this.groupId } : {})
		})) === 1
	}
	
	async remove ([ _, message_ids]) {
		return (await this.api.messages.delete({
			message_ids,
			delete_for_all: 1,
			...(this.groupId ? { group_id: this.groupId } : {})
		}))[`${message_ids}`] === 1
	}
	
	async getUser (id) {
		if (this.userCache.has(id)) return this.userCache.get(id)
		const [ user ] = await this.api.users.get({ user_ids: id, fields: "screen_name" })
		this.userCache.set(id, user)
		return user
	}
	
	attachmentToUrl (v) {
		switch (v.type) {
			case "photo": return v.largeSizeUrl || v.mediumSizeUrl || v.smallSizeUrl
			case "audio_message": return `[Аудиосообщение] ${v.url}`
			case "audio":
			case "doc":
			case "video":
			case "link":
				return `[${v.isHq ? '(HD) ' : ''}${v.artist ? (v.artist + ' - ') : ''}${v.title}] ${v.url || ('https://vk.com/' + v)}`
			case "wall": return `[Запись на стене] https://vk.com/${v}`
			case "graffiti": return `[Граффити] ${v.url}`
			case "market": return `[Товар] https://vk.com/market?w=product${v.ownerId}_${v.id}`
			case "poll": return `[Опрос] https://vk.com/${v}`
			case "sticker": return `[Стикер] https://vk.com/sticker/1-${v.id}-256`
			case "story": return `[Сторис] ${v.link}`
			case "gift": return `[Подарок ВК]`
			case "market_album": return `[Товары ВК]`
			case "wall_reply": return `[Комментарий на стене]`
			default:
				return `${v.url || (v.toString().startsWith('[') ? '[Какая-то хуйня]' : ('https://vk.com/' + v))}`
		}
	}

	async toMessage (ctx) {
		if (ctx.isRemoved) return '[ДАННЫЕ_УДАЛЕНЫ]'
		if (-ctx.senderId === this.groupId) return this.greentext(ctx.text)
		if (ctx.hasMessagePayload) { await ctx.loadMessagePayload() }
		const { first_name, last_name, screen_name } = await this.getUser(ctx.senderId)
		let text = this.tag(screen_name, `${first_name} ${last_name}`)
		if (ctx.hasText) { text += ctx.text }
		if (ctx.attachments.length) {
			text += "\n" + this.greentext(Array.from(ctx.attachments, this.attachmentToUrl).join('\n'))
		}
		if (ctx.hasReplyMessage) {
			text += "\n" + this.greentext(await this.toMessage(ctx.replyMessage))
		}
		if (ctx.hasForwards) {
			for (const msg of ctx.forwards) {
				text += "\n" + this.greentext(await this.toMessage(msg))
			}
		}
		return text
	}
}
