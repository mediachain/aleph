// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'ping <peerId>',
  describe: 'ping a remote node\n',
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
