// @flow

const RestClient = require('../../api/RestClient')
const { subcommand } = require('../util')

type Opts = {client: RestClient, info: boolean, namespace?: string, includeSelf: boolean}

module.exports = {
  command: 'listPeers [namespace]',
  builder: {
    info: {
      type: 'boolean',
      alias: 'i',
      default: false,
      description: 'Also fetch the "info" string for each peer.  This requires an extra network request per-peer.\n'
    },
    includeSelf: {
      type: 'boolean',
      alias: 'all',
      description: 'Include the local node in namespace listings.  Has no effect if namespace is not given.\n',
      default: false
    }
  },
  description: 'Fetch a list of remote peers from a directory server or the DHT. ' +
    'If the `namespace` argument is given, only peers that have published to the given namespace will be returned. ' +
    'Namespace listings require the node to be configured to use a directory server.\n',
  handler: subcommand((opts: Opts) => {
    const {client, info, namespace} = opts
    let {includeSelf} = opts
    if (namespace == null) {
      includeSelf = false
    }

    return client.listPeers(namespace, includeSelf).then(
      peers => {
        if (info) {
          return fetchInfos(peers, opts)
        } else {
          peers.forEach(p => console.log(p))
        }
      }
    )
  })
}

function printInfo (ids: Object, isSelf: boolean = false) {
  let msg = 'No info published'
  if (ids.info != null && ids.info.length > 0) {
    msg = ids.info
  }
  const selfMsg = isSelf ? '(self) ' : ''
  console.log(`${ids.peer} ${selfMsg}-- ${msg}`)
}

function fetchInfos (peerIds: Array<string>, opts: Opts): Promise<*> {
  const {client, includeSelf} = opts
  const promises: Array<Promise<*>> = []
  let selfInfoPromise: Promise<?Object> = includeSelf
    ? client.id()
    : Promise.resolve(null)

  return selfInfoPromise.then(selfInfo => {
    for (const peer of peerIds) {
      if (selfInfo != null && peer === selfInfo.peer) {
        const s = selfInfo // make flow happy by assigning to non-null var before entering new scope
        promises.push(
          Promise.resolve().then(() => {
            printInfo(s, true)
          })
        )
      } else {
        promises.push(
          client.id(peer)
            .then(printInfo)
            .catch(err => { console.log(`${peer} -- Unable to fetch info: ${err.message}`) })
        )
      }
    }
    return Promise.all(promises)
  })
}
