// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, println } = require('../../util')

module.exports = {
  command: 'revoke <peerId>',
  description: 'Revoke all authorizations for the given peer.\n',
  handler: subcommand((opts: {apiUrl: string, peerId: string}) => {
    const {apiUrl, peerId} = opts
    const client = new RestClient({apiUrl})
    return client.revokeAuthorization(peerId)
      .then(() => { println(`Revoked authorization for ${peerId}.`) })
  })
}
