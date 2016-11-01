// @flow

const RestClient = require('../../api/RestClient')

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
  handler: (opts: {apiUrl: string, info: boolean}) => {
    const {apiUrl, info} = opts
    const client = new RestClient({apiUrl})
    client.listPeers().then(
      peers => {
        if (info) {
          fetchInfos(client, peers)
        } else {
          peers.forEach(p => console.log(p))
        }
      },
      err => { console.error(err.message) }
    )
  }
}

function fetchInfos (client: RestClient, peerIds: Array<string>) {
  let promises = []
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
    )
  }

  Promise.all(promises)
    .then(messages => {
      messages.forEach(m => console.log(m))
    })
}
