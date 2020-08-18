const settings = require('./settings')
const App = require('./src/')

console.log('Initializating...')
const inst = new App(settings)
console.log('Starting...')
inst.start().then(() => console.log('Ready!'))
