const Bot = require('./app')
const data = require("./data.json")

const app = new Bot({ ...data })

app.run()
