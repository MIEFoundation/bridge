const settings = require('./settings')
const App = require('./src/')

console.log('Initializating...')
const inst = new App(settings)
console.log('Starting...')
inst.start().then(() => (console.log('Ready!'), process.send('ready')))

process.on('SIGINT', async () => {
  console.log('Stopping...')
  await inst.stop()
  process.exit(0)
})
