// @flow

const RestClient = require('../../../api/RestClient')

module.exports = {
  command: 'revoke <peerId>',
  description: 'Revoke all authorizations for the given peer.\n',
  handler: (opts: {apiUrl: string, peerId: string}) => {
    const {apiUrl, peerId} = opts
    const client = new RestClient({apiUrl})
    client.revokeAuthorization(peerId)
      .then(() => { console.log(`Revoked authorization for ${peerId}.`) })
      .catch(err => { console.error(err.message) })
  }
}
