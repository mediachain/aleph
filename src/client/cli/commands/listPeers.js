// @flow

const RestClient = require('../../api/RestClient')
const { subcommand } = require('../util')

module.exports = {
  command: 'listPeers',
  builder: {
    info: {
      type: 'boolean',
      alias: 'i',
      default: false,
      description: 'Also fetch the "info" string for each peer.  This requires an extra network request per-peer.\n'
    }
  },
  description: `Fetch a list of remote peers from the directory server. The local node must be ` +
    `configured to use a directory server.\n`,
  handler: subcommand((opts: {client: RestClient, info: boolean}) => {
    const {client, info} = opts
    return client.listPeers().then(
      peers => {
        if (info) {
          return fetchInfos(client, peers)
        } else {
          peers.forEach(p => console.log(p))
        }
      }
    )
  })
}

function fetchInfos (client: RestClient, peerIds: Array<string>): Promise<*> {
  const promises: Array<Promise<*>> = []
  for (const peer of peerIds) {
    promises.push(
      client.id(peer)
        .then(ids => {
          let msg = 'No info published'
          if (ids.info != null && ids.info.length > 0) {
            msg = ids.info
          }
          return peer + ` -- ${msg}`
        })
        .catch(err => `${peer} -- Unable to fetch info: ${err.message}`)
        .then(console.log)
    )
  }
  return Promise.all(promises)
}
