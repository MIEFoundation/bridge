const { promises: { mkdir, readFile, writeFile }, existsSync } = require('fs')
const msgpack = require("msgpack-lite")
const { MessageID } = require('./utils')

module.exports = class Storage {
	constructor ({ cacheOnly = false, path = ".storage", saveInterval = 60 * 10 }) {
		this.path = path
		this.pathBackup = path + "~"
		this.cacheOnly = cacheOnly
		this.cache = new Map()
		this.saveInterval = saveInterval * 1000
		this.timestamps = new Map()
	}

	async get (id) {
		return this.cache.get(id.toString())
	}
	async set (id, value) {
		this.cache(id.toString(), value)
		return this
	}
	async delete (id) {
		this.cache.delete(id.toString())
		return this
	}
	
	async cleanup () {
		let i = 0
		for (const id of this.cache.keys()) {
			const ts = this.timestamps.get(id)
			if (ts < (Date.now() - (1000 * 60 * 60 * 24))) {
				this.cache.delete(id)
				this.timestamps.delete(id)
				i++
			}
		}
		return i
	}
	
	async readFile () {
		const { msg, ts } = msgpack.decode(
			await readFile(this.existsSync(this.path) ? this.path : this.pathBackup)
		)
		for (const key in msg) {
			this.cache.set(key, msg[key].map(MessageID.fromString))
			this.timestamps.set(key, ts[key])
		}
	}
	
	async writeFile () {
		const msg = {}
		const ts = {}
		for (const [key, msgs] of this.cache.entries()) {
			msg[key] = msgs.map(v => v.toString())
			ts[key] = this.timestamps.get(key)
		}
		await writeFile(this.pathBackup, msgpack.encode({ msg, ts }))
		await unlink(this.path)
		await rename(this.pathBackup, this.path)
	}

	async start () {
		if (this.cacheOnly) return
		if (existsSync(this.path) || existsSync(this.pathBackup)) { await this.readFile() }
		setTimeout(async () => {
			console.log(`* Cleaned up ${await this.cleanup()} messages`)
			if (!this.cacheOnly) {
				await this.writeFile()
			}
		}, this.saveInterval)
	}
}
