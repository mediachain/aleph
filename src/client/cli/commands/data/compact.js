// @flow

import type {RestClient} from '../../../api'
const {subcommand, println} = require('../../util')

module.exports = {
  command: 'compact',
  description: 'Compact the datastore to optimize disk usage.\n',
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts
    return client.compactDatastore()
      .then(() => {
        println('Compaction successful')
      })
  })
}
