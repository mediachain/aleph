// @flow

const RestClient = require('../../api/RestClient')
const { subcommand, println } = require('../util')

module.exports = {
  command: 'lookupPeer <peerId>',
  describe: 'Lookup a remote peer, identified by `peerId`. ' +
  'Will first try the directory if one is configured, otherwise will fallback to DHT lookup.\n',
  handler: subcommand((opts: {peerId: string, client: RestClient}) => {
    const {peerId, client} = opts

    return client.netLookup(peerId)
      .then(
        addrs => {
          addrs.forEach(a => { println(a) })
        },
        err => { throw new Error(`Error during peer lookup: ${err.message}`) }
      )
  })
}
