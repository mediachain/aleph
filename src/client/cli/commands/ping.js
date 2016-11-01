// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'ping <peerId>',
  describe: 'Ping a remote peer, identified by `peerId`. ' +
  'The local node must be configured to use a directory server.\n',
  handler: (opts: {peerId: string, apiUrl: string}) => {
    const {peerId, apiUrl} = opts
    console.log('pinging peer: ', peerId)

    const client = new RestClient({apiUrl})
    client.ping(peerId)
      .then(
        success => console.log(`ping OK`),
        err => console.error('error pinging: ', err.message)
      )
  }
}
