class MessageID extends Array {
  constructor (prefix, ...args) {
    super(...args)
    this.prefix = prefix
  }

  static fromString (str) { return new MessageID(...str.split('-')) }
  toString () { return this.prefix + '-' + this.valueOf().join('-') }
}

class BasePlatform {
  get tagName () { return '' }
  get idName () { return 'ID' }
  
  on () {
      // It's NOT recommended to call this method directly
  }

  onSend (fn) { return this.on('send', fn) }
  onEdit (fn) { return this.on('edit', fn) }
  onRemove (fn) { return this.on('remove', fn) }

  createId (...args) {
    return new MessageID(this.idName, ...args)
  }

  tag (id, name = '') {
    return '<@' + id + (name && ` (${name})`) + '> ' + (this.tagName && `[${this.tagName}] `)
  }

  greentext (text) {
    return text.split('\n').map(v => '> ' + v).join('\n')
  }

  async start () {
    // To implement
  }

  async stop () {
    // To implement
  }
}

function mapChatsToDictionary ({ platforms, chats }) {
  const dict = {}
  for (const platformName of Object.keys(platforms)) {
    const obj = {}
    for (const [, chatObj] of Object.entries(chats)) {
      const chat = { ...chatObj }
      delete chat[platformName]
      obj[chatObj[platformName]] = chat
    }
    dict[platformName] = obj
  }
  return dict
}

module.exports = {
  MessageID,
  BasePlatform,
  mapChatsToDictionary
}
