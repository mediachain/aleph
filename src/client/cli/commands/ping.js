// @flow

const RestClient = require('../../api/RestClient')
const { subcommand } = require('../util')

module.exports = {
  command: 'ping <peerId>',
  describe: 'Ping a remote peer, identified by `peerId`. ' +
  'The local node must be configured to use a directory server.\n',
  handler: subcommand((opts: {peerId: string, client: RestClient}) => {
    const {peerId, client} = opts
    console.log('Pinging peer: ', peerId)

    return client.ping(peerId)
      .then(
        success => console.log('Ping OK'),
        err => { throw new Error(`Error pinging: ${err.message}`) }
      )
  })
}
