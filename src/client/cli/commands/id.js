// @flow

const RestClient = require('../../api/RestClient')
const {subcommand} = require('../util')

module.exports = {
  command: 'id [peerId]',
  description: 'Request the peer id, publisher id, and info string of the local node, ' +
    'or a remote peer if `peerId` is given and a directory server is connected.\n',
  handler: subcommand((opts: {client: RestClient, peerId?: string}) => {
    const {client, peerId} = opts
    return client.id(peerId).then(
      printIds,
      err => { console.error(err.message) }
    )
  })
}

function printIds (opts: {peer: string, publisher: string, info: string}) {
  const {peer, publisher, info} = opts
  console.log(`Peer ID: ${peer}`)
  console.log(`Publisher ID: ${publisher}`)
  console.log(`Info: ${info}`)
}
