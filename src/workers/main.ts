// Libraries
import { Worker, FlowProducer } from 'bullmq'
import { Redis } from 'ioredis'
// ORM
import { MikroORM } from '@mikro-orm/sqlite'
import type { SqliteDriver } from '@mikro-orm/sqlite'
import { TsMorphMetadataProvider } from '@mikro-orm/reflection'
import { RichMessageModel } from '../entities'
import { wrap } from '@mikro-orm/core'
// Typings
import { Options, RichMessage, Jobs } from '../types'

export default async function createMainWorker(options: Options.Workers.MainWorker) {
  const connection = new Redis(options.redisClientUrl ?? 'redis://')
  const orm = await MikroORM.init<SqliteDriver>({
    metadataProvider: TsMorphMetadataProvider,
    entities: [ RichMessageModel ],
    dbName: options.databaseName,
    type: 'sqlite',
    clientUrl: options.databaseClientUrl
  })
  const flowProducer = new FlowProducer({ connection })
  const mainWorker = new Worker<Jobs.DataTypeAll, Jobs.DataResultAll, Jobs.DataNameAll>(options.mainQueueName, async function processJob(job) {
    switch (job.name) {
      case Jobs.OnNewMessage.Name: {
        const data = job.data as Jobs.OnNewMessage.Data
        flowProducer.add({
          name: Jobs.DatabaseSaveMessage.Name,
          data,
          queueName: options.mainQueueName,
          children: platformQueues.map(queueName => ({
            name: Jobs.MessageCreate.Name,
            data: { dest: queueName, content: data.content } satisfies Jobs.MessageCreate.Data,
            queueName: queueName
          })),
        })
        return
      }
      // Events
      case Jobs.onCreate:
      case Jobs.onEdit:
      case Jobs.onRemove:
        {
          const nextJob = JobEventHandling[job.name]
          flowProducer.add({
            name: nextJob,
            data: job.data,
            queueName: Queues.main,
            children: platformQueues.map(queueName => ({
              name: nextJob,
              data: { message: job.data, destination: queueName },
              queueName: queueName,
              opts: { priority: JobPriority[nextJob] }
            })),
          })
          break
        }
      // Jobs
      case Jobs.DatabaseSaveMessage.Name:
        {
          const destinations: Jobs.DatabaseSaveMessage.Children = Object.values(await job.getChildrenValues())
          const data = job.data as Jobs.DatabaseSaveMessage.Data
          const message = { ...data.content, source: data.source, destinations } satisfies Omit<RichMessage.Message, 'id'>
          await orm.em.insert(RichMessageModel, message)
          break
        }
      case Jobs.DatabaseUpdateMessage.Name:
        {
          const message = job.data as Jobs.MessageUpdate.Data
          const entity = await orm.em.findOneOrFail(RichMessageModel, { source: message.destId })
          await wrap(entity).assign(message.newContent)
          await orm.em.flush()
          break
        }
      case Jobs.DatabaseRemoveMessage.Name:
        {
          const source = job.data as Jobs.MessageRemove.Data
          const entity = await orm.em.findOne(RichMessageModel, { source })
          if (entity) await orm.em.removeAndFlush(entity)
          break
        }
      default: throw new Error(`Unknown job "${job.name}": ${JSON.stringify(job)}`)
    }
  }, { connection })

  await mainWorker.waitUntilReady()
  mainWorker.on('closing', () => flowProducer.close())
  return mainWorker
}

/*
export default async function main (options: MainWorkerOptions = workerData) {
  const worker = await createMainWorker(options)
  process.on('SIGTERM', async () => {
    try {
      await worker.close()
      process.exit(0)
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })
}
*/