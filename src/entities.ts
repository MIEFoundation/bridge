import type { RichMessage, RichMessageContent } from './types'
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'

@Entity({ tableName: 'messages', forceConstructor: true })
export class RichMessageModel implements RichMessage {
  @PrimaryKey()
  id = randomUUID()

  @Property()
  destinations: RichMessage['destinations']

  @Property()
  source: RichMessage['source']

  @Property({ lazy: true })
  sender: RichMessage['sender']

  @Property({ lazy: true })
  text?: RichMessage['text']

  @ManyToOne()
  reply?: RichMessageModel

  @Property({ lazy: true })
  attachments?: RichMessage['attachments']

  @Property()
  createdAt = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date()

  constructor (content: RichMessageContent & Pick<RichMessage, 'destinations'>) {
    this.source = content.source
    this.sender = content.sender
    this.text = content.text
    this.reply = content.reply as RichMessageModel
    this.attachments = content.attachments
    this.destinations = content.destinations
  }
}
