// @flow

const RestClient = require('../../../api/RestClient')
const { printJSON } = require('../../util')

module.exports = {
  command: 'show',
  description: 'Show the peers authorized to push data to the local node.\n',
  handler: (opts: {apiUrl: string}) => {
    const {apiUrl} = opts
    const client = new RestClient({apiUrl})
    client.getAuthorizations()
      .then(authInfo => printJSON(authInfo))
      .catch(err => console.error(err.message))
  }
}
