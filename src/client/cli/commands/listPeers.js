// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'listPeers',
  description: `fetch a list of peers from the node's directory server.\n`,
  handler: (opts: {apiUrl: string}) => {
    const {apiUrl} = opts
    const client = new RestClient({apiUrl})
    client.listPeers().then(
      peers => { peers.forEach(p => console.log(p)) },
      err => { console.error(err.message) }
    )
  }
}
