// @flow

const fs = require('fs')
const ndjson = require('ndjson')
const RestClient = require('../../api/RestClient')
const { subcommand } = require('../util')
import type { Readable } from 'stream'

const BATCH_SIZE = 1000

module.exports = {
  command: 'putData [filename]',
  description: 'Read newline-delimited JSON data from `filename` or stdin and store in the remote node as IPLD.\n',
  builder: {
    batchSize: { default: BATCH_SIZE }
  },

  handler: subcommand((opts: {client: RestClient, batchSize: number, filename: ?string}) => {
    const {client, batchSize, filename} = opts
    const streamName = filename || 'standard input'

    let items: Array<Object> = []
    let promises: Array<Promise<*>> = []

    let inputStream: Readable
    if (filename) {
      inputStream = fs.createReadStream(filename)
    } else {
      inputStream = process.stdin
    }

    return new Promise((resolve, reject) => {
      inputStream.pipe(ndjson.parse())
        .on('data', obj => {
          items.push(obj)
          if (items.length >= batchSize) {
            promises.push(putItems(client, items))
            items = []
          }
        })
        .on('end', () => {
          if (items.length > 0) {
            promises.push(putItems(client, items))
          }
          Promise.all(promises)
            .then(() => resolve())
        })
        .on('error', err => {
          console.error(`Error reading from ${streamName}: `, err)
          reject(err)
        })
    })
  })
}

function putItems (client: RestClient, items: Array<Object>): Promise<*> {
  return client.putData(...items).then(
    hashes => {
      hashes.forEach(h => console.log(h))
    },
    err => console.error(err.message)
  )
}
