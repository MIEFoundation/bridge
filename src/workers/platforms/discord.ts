import { Options, RichMessage, Jobs } from '../../types'
import { Worker, Queue } from 'bullmq'
import { Redis } from 'ioredis'
import type { TextChannel, Message } from 'discord.js'
import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js'

function setupListener (discord: Client, connection: Redis, options: Options.Workers.PlatformWorker) {
  const mainQueue = new Queue<Jobs.DataTypeEvents, Jobs.DataResultEvents, Jobs.DataNameEvents>(options.mainQueueName, { connection })
  discord.on(Events.MessageCreate, (message) => {
    if (message.author.id === discord.user?.id) return
    if (!message.inGuild()) {
      message.reply('Данный бот работает только в серверах. Пожалуйста обратитесь к вашему администратору')
      return
    }
    const jobData = {
      source: {
        service: options.serviceName,
        roomId: message.guildId,
        messageId: message.id,
      },
      content: messageToRich(message),
    } satisfies Jobs.OnNewMessage.Data
    mainQueue.add(Jobs.OnNewMessage.Name, jobData)
  })
  discord.on(Events.MessageUpdate, (message) => {
    if (!message.inGuild() || message.author.id === discord.user?.id) return
    const jobData = {
      source: {
        service: options.serviceName,
        roomId: message.guildId,
        messageId: message.id,
      },
      newContent: messageToRich(message),
    } satisfies Jobs.OnUpdatedMessage.Data
    mainQueue.add(Jobs.OnUpdatedMessage.Name, jobData)
  })
  discord.on(Events.MessageBulkDelete, (messages) => {
    for (const message of messages.values()) {
      if (!message.inGuild() || message.author.id === discord.user?.id) continue
      const jobData = {
        service: options.serviceName,
        roomId: message.guildId,
        messageId: message.id,
      } satisfies Jobs.OnRemovedMessage.Data
      mainQueue.add(Jobs.OnRemovedMessage.Name, jobData)
    }
  })
  discord.on(Events.MessageDelete, (message) => {
    if (!message.inGuild() || message.author.id === discord.user?.id) return
    const jobData = {
      service: options.serviceName,
      roomId: message.guildId,
      messageId: message.id,
    } satisfies Jobs.OnRemovedMessage.Data
    mainQueue.add(Jobs.OnRemovedMessage.Name, jobData)
  })
  return mainQueue
}

function messageToRich (message: Message<true>): RichMessage.Content {
  return {
    sender: {
      accountURI: message.author.username + `@discord.com`,
      displayName: message.author.username,
    },
    text: message.content,
    reply: message.reference?.messageId ? {
      id: '',
      source: {
        service: 'discord',
        roomId: message.reference.channelId,
        messageId: message.reference.messageId,
      }
    } : undefined,
    attachments: Array.from(message.attachments.values(), attach => ({
      type: attach.contentType?.startsWith('image/') ? 'image' : 'file',
      url: attach.url,
    }))
  }
}

function contentHeader (content: RichMessage.Content) {
  let str = `**${content.sender.displayName}**`
  if (content.sender.accountURI) str += ` [${content.sender.accountURI}]`
  return str + ': '
}

async function setupWorker (discord: Client, connection: Redis, options: Options.Workers.PlatformWorker) {
  async function CreateMessage ({ dest, content }: Jobs.MessageCreate.Data): Promise<Jobs.MessageCreate.Result> {
    const channel = await discord.channels.fetch(dest.roomId) as TextChannel | null
    if (!channel) throw new Error(`Room "${dest.roomId}" error: not found`)
    if (!channel.isTextBased()) throw new Error(`Room "${dest.roomId}" error: not text channel`)
    const message = await channel.send({
      content: contentHeader(content) + content.text,
      files: content.attachments?.map(({ type, url }) => ({ name: type, attachment: url })),
    })
    return {
      ...dest,
      messageId: message.id,
    }
  }

  async function UpdateMessage ({ destId, oldContent, newContent }: Jobs.MessageUpdate.Data): Promise<Jobs.MessageUpdate.Result> {
    const channel = await discord.channels.fetch(destId.roomId) as TextChannel | null
    if (!channel) throw new Error(`Room "${destId.roomId}" error: not found`)
    if (!channel.isTextBased()) throw new Error(`Room "${destId.roomId}" error: not text channel`)
    const message = await channel.messages.fetch(destId.messageId)
    if (!message) throw new Error(`Message "${destId.messageId}" error: not found`)
    const newMessage = await message.edit({
      content: contentHeader(newContent) + newContent.text,
      files: newContent.attachments?.map(({ type, url }) => ({ name: type, attachment: url })),
    })
    return destId
  }

  async function RemoveMessage (destId: Jobs.MessageRemove.Data): Promise<Jobs.MessageRemove.Result> {
    const channel = await discord.channels.fetch(destId.roomId) as TextChannel | null
    if (!channel) throw new Error(`Room "${destId.roomId}" error: not found`)
    if (!channel.isTextBased()) throw new Error(`Room "${destId.roomId}" error: not text channel`)
    const message = await channel.messages.fetch(destId.messageId)
    if (message) await message.delete()
    if (destId.additionals?.length) await channel.bulkDelete(destId.additionals)
  }

  const platformWorker = new Worker<Jobs.DataTypeActions, Jobs.DataResultActions, Jobs.DataNameActions>(options.mainQueueName, async function JobProcessor(job) {
    switch (job.name) {
      case Jobs.MessageCreate.Name: return CreateMessage(job.data as Jobs.MessageCreate.Data)
      case Jobs.MessageUpdate.Name: return UpdateMessage(job.data as Jobs.MessageUpdate.Data)
      case Jobs.MessageRemove.Name: return RemoveMessage(job.data as Jobs.MessageRemove.Data)
      default: throw new Error(`Unknown job "${job.name}": ${JSON.stringify(job)}`)
    }
  }, { connection })

  await platformWorker.waitUntilReady()
  return platformWorker
}

export default async function createWorker(options: Options.Workers.PlatformWorker) {
  const connection = new Redis(options.redisClientUrl ?? 'redis://')
  const discord = new Client({
    presence: options.platformOptions.presence ?? {
      status: 'online',
      activities: [
        {
          type: ActivityType.Watching
        }
      ]
    },
    intents: [
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageTyping
    ]
  })
  await discord.login(options.platformOptions.token)
  const listener = await setupListener(discord, connection, options)
  const worker = await setupWorker(discord, connection, options)
  worker.on('closing', () => listener.close())
  listener.on('ioredis:close', () => discord.destroy())
  return worker
}
