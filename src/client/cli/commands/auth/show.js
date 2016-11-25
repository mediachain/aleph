// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, printJSON } = require('../../util')

module.exports = {
  command: 'show',
  description: 'Show the peers authorized to push data to the local node.\n',
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts
    return client.getAuthorizations()
      .then(authInfo => printJSON(authInfo))
      .catch(err => console.error(err.message))
  })
}
