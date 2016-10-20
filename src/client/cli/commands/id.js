// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'id [peerId]',
  description: 'request the peer ids of the connected peer, ' +
    'or a different peer if peerId is given and a directory server is connected\n',
  handler: (opts: {peerUrl: string, peerId?: string}) => {
    const {peerUrl, peerId} = opts
    const client = new RestClient({peerUrl})
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
