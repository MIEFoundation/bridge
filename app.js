const settings = require('./settings')
const App = require('./src/')

const inst = new App(settings)
inst.start().then(() => console.log('Ready!'))
