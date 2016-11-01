// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'shutdown',
  description: 'Tell the local node to shutdown.\n',
  handler: (opts: {apiUrl: string}) => {
    const {apiUrl} = opts
    const client = new RestClient({apiUrl})
    client.shutdown().then(
      console.log('Node shutdown successfully'),
      err => { console.error(err.message) }
    )
  }
}
