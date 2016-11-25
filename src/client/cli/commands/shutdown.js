// @flow

const RestClient = require('../../api/RestClient')
const { subcommand } = require('../util')

module.exports = {
  command: 'shutdown',
  description: 'Tell the local node to shutdown.\n',
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts
    return client.shutdown().then(
      console.log('Node shutdown successfully'),
      err => { console.error(err.message) }
    )
  })
}
