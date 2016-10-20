// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'id [peerId]',
  description: 'request the peer ids of the connected peer, ' +
    'or a different peer if peerId is given and a directory server is connected\n',
  handler: (opts: {peerUrl: string, peerId?: string}) => {
    const {peerUrl, peerId} = opts
    const client = new RestClient({peerUrl})
    client.id().then(
      response => { console.log(response) },
      err => { console.error(err.message) }
    )
  }
}
