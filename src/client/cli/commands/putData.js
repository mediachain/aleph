// @flow

const fs = require('fs')
const ndjson = require('ndjson')
const RestClient = require('../../api/RestClient')
import type { Readable } from 'stream'

const BATCH_SIZE = 1000

module.exports = {
  command: 'putData [filename]',
  description: 'read newline-delimited JSON data from `filename` or stdin and store in the remote node as IPLD',
  builder: {
    batchSize: { default: BATCH_SIZE }
  },

  handler: (opts: {peerUrl: string, batchSize: number, filename: ?string}) => {
    const {peerUrl, batchSize, filename} = opts
    const client = new RestClient({peerUrl})

    let items: Array<Object> = []

    let inputStream: Readable
    if (filename) {
      inputStream = fs.createReadStream(filename)
    } else {
      inputStream = process.stdin
    }

    inputStream.pipe(ndjson.parse())
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
