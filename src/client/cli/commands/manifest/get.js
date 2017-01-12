// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, printJSON } = require('../../util')

module.exports = {
  command: 'get [remotePeer]',
  description: `Get the signed manifests for the local node or a remote peer.\n`,
  handler: subcommand((opts: {client: RestClient, remotePeer?: string}) => {
    const {client, remotePeer} = opts
    return client.getManifests(remotePeer)
      .then(m => printJSON(m))
  })
}
