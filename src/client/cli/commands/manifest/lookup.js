// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, printJSON } = require('../../util')

module.exports = {
  command: 'lookup <entityId>',
  builder: {
    entityId: {
      type: 'string',
      description: 'An "entity" identifier that can be used to verify a public identity. ' +
        'e.g: "blockstack:mediachainlabs.id" or "keybase:yusef"'
    }
  },
  description: `Query the directory for the manifests belonging to \`entityId\`.\n`,
  handler: subcommand((opts: {client: RestClient, entityId: string}) => {
    const {client, entityId} = opts
    return client.listManifestsForEntity(entityId)
      .then(m => printJSON(m))
  })
}
