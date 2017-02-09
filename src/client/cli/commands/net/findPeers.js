// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, println } = require('../../util')

module.exports = {
  command: 'findPeers',
  description: `Find all public peers registerd in the DHT.\n`,
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts

    return client.netFindPeers()
      .then(
        peers => {
          peers.forEach(peer => {
            println(peer)
          })
        })
      .catch(
        err => { throw new Error(`Error finding peers: ${err.message}`) }
      )
  })
}
