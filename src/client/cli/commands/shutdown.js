// @flow

const RestClient = require('../../api/RestClient')
const { subcommand, println } = require('../util')

module.exports = {
  command: 'shutdown',
  description: 'Tell the local node to shutdown.\n',
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts
    return client.shutdown().then(
      println('Node shutdown successfully')
    )
  })
}
