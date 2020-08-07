const platforms = require('./platforms')
const Storage = require('./storage')
const { mapChatsToDictionary } = require('./utils')

const MSG_HEAD = '\x1b[37m[%s]\x1b[0m %s'
const MSG_NEW = '\x1b[42mN'
const MSG_EDT = '\x1b[44mE'
const MSG_REM = '\x1b[41mD'

module.exports = class App {
	constructor (settings) {
		this.toName = mapChatsToDictionary(settings)
		this.storage = new Storage(settings.storage)
		
		this.instances = {}
		for (const [ platformName, { name, config } ] of Object.entries(settings.platforms)) {
			const inst = new platforms[name](config)
			const toName = this.toName[platformName]
			if (settings.logging) {
				inst.onSend((id, msg) => console.log(MSG_NEW + MSG_HEAD, id, msg))
					.onEdit((id, msg) => console.log(MSG_EDT + MSG_HEAD, id, msg))
					.onRemove((id, msg) => console.log(MSG_REM + MSG_HEAD, id, msg))
			}
			inst.onSend(async (id, msg) => {
				const ids = []
				const chat = toName[id[0]]
				for (const chatId in chat) {
					ids.push(await this.instances[chatId].send(chat[chatId], msg))
				}
				await this.addMessages(id, ids)
			})
			.onEdit(async (id, msg) => {
				const ids = await this.fetchMessages(id)
				const chat = Object.keys(toName[id[0]])
				for (let i = 0, l = chat.length; i < l; i++) {
					await this.instances[chat[i]].edit(ids[i], msg)
				}
			})
			.onRemove(async (id, msg) => {
				const ids = await this.fetchMessages(id)
				const chat = Object.keys(toName[id[0]])
				for (let i = 0, l = chat.length; i < l; i++) {
					await this.instances[chat[i]].remove(ids[i])
				}
				await this.removeMessages(id)
			})
			
			this.instances[platformName] = inst
		}
	}
	
	async fetchMessages (id) { return this.storage.get(id.toString()) }
	async addMessages (id, msgids) { return this.storage.set(id.toString(), msgids) }
	async removeMessages (id) { return this.storage.delete(id.toString()) }
	
	async start () {
		console.log('Starting...')
		await this.storage.start()
		console.log('* Message storage ready')
		await Promise.all(Object.entries(this.instances).map(async ([name, inst]) => {
			await inst.start()
			console.log(`* ${name} [${inst.constructor.name}] ready`)
		}))
	}
}
