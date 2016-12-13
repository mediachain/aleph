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
    },
    namespace: {
      type: 'string',
      description: 'If given, only return peers that have published to the given namespace. ' +
       `Can use wildcards, e.g. 'images.*'\n`
    },
    includeSelf: {
      type: 'boolean',
      alias: 'all',
      description: 'Include the local node in namespace listings.  Has no effect if --namespace is not present.\n',
      default: false
    }
  },
  description: `Fetch a list of remote peers from the directory server. The local node must be ` +
    `configured to use a directory server.\n`,
  handler: subcommand((opts: {client: RestClient, info: boolean, namespace?: string, includeSelf: boolean}) => {
    const {client, info, namespace, includeSelf} = opts
    return client.listPeers(namespace, includeSelf).then(
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
