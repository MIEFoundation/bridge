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
    this.failsafe = settings.failsafe
    this.logging = settings.logging

    this.instances = {}
    for (const [name, config] of Object.entries(settings.platforms)) {
      try {
        this.initPlatform(name, config)
      } catch (e) {
        console.warn(`* Error initializating platform ${name}:\n`, e)
        if (!this.failsafe) {
          process.exit(1)
        }
        continue
      }
    }
  }

  initPlatform (platformName, { name, config }) {
    if (!platforms[name]) {
      throw new Error(`${name} platform support not available`)
    }
    const inst = new platforms[name](config)
    const toName = this.toName[platformName]
    if (this.logging) {
      inst.onSend((id, msg) => console.log(MSG_NEW + MSG_HEAD, id, msg))
        .onEdit((id, msg) => console.log(MSG_EDT + MSG_HEAD, id, msg))
        .onRemove((id, msg) => console.log(MSG_REM + MSG_HEAD, id, msg))
    }
    inst.onSend(async (id, msg) => {
      const ids = []
      const chat = toName[id[0]]
      if (!chat) return
      for (const chatId in chat) {
        if (!this.instances[chatId]) continue
        try {
          ids.push(await this.instances[chatId].send(chat[chatId], msg))
        } catch (e) {
          console.warn(`* Caught error on platform ${chatId} on message sending:\n`, e)
          if (!this.failsafe) process.exit(1)
        }
      }
      await this.addMessages(id, ids)
    })
      .onEdit(async (id, msg) => {
        const ids = await this.fetchMessages(id)
        const chat = toName[id[0]]
        if (!chat) return
        let i = 0
        for (const chatId in chat) {
          if (!this.instances[chatId]) continue
          try {
            await this.instances[chatId].edit(ids[i], msg)
          } catch (e) {
            console.warn(`* Caught error on platform ${chatId} on message edit:\n`, e)
            if (!this.failsafe) process.exit(1)
          }
          i++
        }
      })
      .onRemove(async (id, msg) => {
        const ids = await this.fetchMessages(id)
        const chat = toName[id[0]]
        if (!chat) return
        const i = 0
        for (const chatId in chat) {
          if (!this.instances[chatId]) continue
          try {
            await this.instances[chatId].remove(ids[i])
          } catch (e) {
            console.warn(`* Caught error on platform ${chatId} on message remove:\n`, e)
            if (!this.failsafe) process.exit(1)
          }
        }
        await this.removeMessages(id)
      })
    this.instances[platformName] = inst
  }

  async fetchMessages (id) { return this.storage.get(id) }
  async addMessages (id, msgids) { return this.storage.set(id, msgids) }
  async removeMessages (id) { return this.storage.delete(id) }

  async start () {
    await this.storage.start()
    console.log('* Message storage ready')
    await Promise.all(Object.entries(this.instances).map(async ([name, inst]) => {
      try {
        await inst.start()
        console.log(`* ${name} [${inst.constructor.name}] ready`)
      } catch (e) {
        console.warn(`* ${name} [${inst.constructor.name}] failed`)
        if (!this.failsafe) process.exit(1)
      }
    }))
  }
}
