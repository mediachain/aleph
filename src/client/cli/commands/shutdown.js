// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'shutdown',
  description: 'tell the node to shutdown',
  handler: (opts: {apiUrl: string}) => {
    const {apiUrl} = opts
    const client = new RestClient({apiUrl})
    client.shutdown().then(
      console.log('Node shutdown successfully'),
      err => { console.error(err.message) }
    )
  }
}
