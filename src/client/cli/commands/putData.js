// @flow

const ndjson = require('ndjson')
const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'putData',
  description: 'read newline-delimited JSON data from standard input and store in the remote node as IPLD',

  handler: (opts: {peerUrl: string}) => {
    const {peerUrl} = opts
    const client = new RestClient({peerUrl})

    const items: Array<Object> = []
    process.stdin.pipe(ndjson.parse())
      .on('data', obj => items.push(obj))
      .on('error', err => console.error('Error reading from stdin: ', err))
      .on('end', () => {
        client.putData(...items)
          .then(
            console.log,
            err => console.error(err.message)
          )
      })
  }
}
