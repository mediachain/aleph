// @flow

const ndjson = require('ndjson')
const RestClient = require('../../api/RestClient')

const BATCH_SIZE = 1000

module.exports = {
  command: 'putData',
  description: 'read newline-delimited JSON data from standard input and store in the remote node as IPLD',
  builder: {
    batchSize: { default: BATCH_SIZE }
  },

  handler: (opts: {peerUrl: string, batchSize: number}) => {
    const {peerUrl, batchSize} = opts
    const client = new RestClient({peerUrl})

    let items: Array<Object> = []

    process.stdin.pipe(ndjson.parse())
      .on('data', obj => {
        items.push(obj)
        if (items.length >= batchSize) {
          client.putData(...items).then(
            hashes => {
              hashes.forEach(h => console.log(h))
            },
            err => console.error(err.message)
          )
          items = []
        }
      })
      .on('error', err => console.error('Error reading from stdin: ', err))
  }
}
