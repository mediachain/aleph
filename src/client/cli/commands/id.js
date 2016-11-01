// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'id [peerId]',
  description: 'Request the peer id, publisher id, and info string of the local node, ' +
    'or a remote peer if `peerId` is given and a directory server is connected.\n',
  handler: (opts: {apiUrl: string, peerId?: string}) => {
    const {apiUrl, peerId} = opts
    const client = new RestClient({apiUrl})
    client.id(peerId).then(
      printIds,
      err => { console.error(err.message) }
    )
  }
}

function printIds (opts: {peer: string, publisher: string, info: string}) {
  const {peer, publisher, info} = opts
  console.log(`Peer ID: ${peer}`)
  console.log(`Publisher ID: ${publisher}`)
  console.log(`Info: ${info}`)
}
