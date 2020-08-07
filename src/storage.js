const { mkdir } = require('fs').promises

module.exports = class Storage {
	constructor ({ path }) {
		this.path = path
		this.storage = require('node-persist')
	}

	async get (id) { return this.storage.getItem(id) }
	async set (id, value) { return this.storage.setItem(id, value) }
	async delete (id) { return this.storage.removeItem(id) }

	async start () {
		await mkdir(this.path, { recursive: true })
		await this.storage.init({
			dir: this.path,
			stringify: JSON.stringify,
			parse: JSON.parse,
			forgiveParseErrors: true
		})
	}
}
