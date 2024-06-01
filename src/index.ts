import mainWorker from './workers/main'

const MONOLITE_MODE = process.env.MONOLITE_MODE === 'true' || process.env.MONOLITE_MODE === '1'
const REDIS_URL = process.env.REDIS_URL || undefined
const POSTGRES_URL = process.env.POSTGRES_URL || undefined

const platformsUsed = ['discord'] as string[]

if (MONOLITE_MODE) {
  mainWorker({
    redisClientUrl: REDIS_URL,
    databaseClientUrl: POSTGRES_URL,
    platformQueues: platformsUsed
  })
} else {

}
