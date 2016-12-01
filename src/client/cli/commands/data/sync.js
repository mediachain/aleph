// @flow

import type {RestClient} from '../../../api'
const {subcommand} = require('../../util')

module.exports = {
  command: 'sync',
  description: 'Flushes the datastore.  Useful for immediately reclaiming space after garbage collection\n',
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts
    return client.syncDatastore()
      .then(count => {
        console.log(`Sync successful`)
      })
  })
}
