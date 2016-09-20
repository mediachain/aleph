// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'ping <peerId>',
  describe: 'ping a remote node',
  handler: (opts: {peerId: string, peerUrl: string}) => {
    const {peerId, peerUrl} = opts
    console.log('pinging peer: ', peerId)

    const client = new RestClient({peerUrl})
    client.ping(peerId)
      .then(
        success => {
          console.log(`ping OK`)
        },
        err => {
          console.error('error pinging: ', err.status.code)
        }
      )
  }
}
