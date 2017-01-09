// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, println } = require('../../util')

module.exports = {
  command: 'ping <peerId>',
  describe: 'Ping a remote peer, identified by `peerId`, using the libp2p ping protocol. ' +
  'Will attempt to lookup the peer with a configured directory server or DHT.\n',
  handler: subcommand((opts: {peerId: string, client: RestClient}) => {
    const {peerId, client} = opts
    println('Pinging peer: ', peerId)

    return client.netPing(peerId)
      .then(
        latency => println(`Ping OK. Latency: ${latency}`),
        err => { throw new Error(`Error pinging: ${err.message}`) }
      )
  })
}
