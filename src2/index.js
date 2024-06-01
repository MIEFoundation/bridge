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
    this.messages = this.storage.proxy()
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
    inst
      .onSend(async (id, msg) => {
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
        this.messages[id] = ids
      })
      .onEdit(async (id, msg) => {
        const ids = this.messages[id]
        if (!ids) return
        for (const chat of ids) {
          const [chatId] = chat
          const chatName = toName[chatId]
          console.log(chatName, this.instances[chatName])
          if (!this.instances[chatName]) continue
          try {
            await this.instances[chatName].edit(chat, msg)
          } catch (e) {
            console.warn(`* Caught error on platform ${chatName} on message edit:\n`, e)
            if (!this.failsafe) process.exit(1)
          }
        }
      })
      .onRemove(async (id, msg) => {
        const ids = this.messages[id]
        if (!ids) return
        for (const chat of ids) {
          const [chatId] = chat
          const chatName = toName[chatId]
          if (!this.instances[chatName]) continue
          try {
            await this.instances[chatName].remove(chat)
          } catch (e) {
            console.warn(`* Caught error on platform ${chatName} on message remove:\n`, e)
            if (!this.failsafe) process.exit(1)
          }
        }
        delete this.messages[id]
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
        console.warn(`* ${name} [${inst.constructor.name}] failed`, e)
        if (!this.failsafe) process.exit(1)
      }
    }))
  }

  async stop () {
    await Promise.all(Object.entries(this.instances).map(async ([name, inst]) => {
      try {
        await inst.stop()
        console.log(`* ${name} [${inst.constructor.name}] stopped gracefully`)
      } catch (e) {
        console.warn(`* ${name} [${inst.constructor.name}] not stopped properly`)
      }
    }))
    await this.storage.stop()
    console.log('* Message storage stopped')
  }
}
