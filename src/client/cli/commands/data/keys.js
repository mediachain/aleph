// @flow

import type {RestClient} from '../../../api'
const {subcommand, println} = require('../../util')

module.exports = {
  command: 'keys',
  description: 'Print the keys for all objects in the datastore.\n',
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts
    return client.getDatastoreKeyStream()
      .then(stream => new Promise((resolve, reject) => {
        stream.on('data', data => { println(data.toString()) })
        stream.on('error', reject)
        stream.on('end', () => resolve())
      }))
  })
}
