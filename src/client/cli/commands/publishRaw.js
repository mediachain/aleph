// @flow

const RestClient = require('../../api/RestClient')
const { subcommand, println } = require('../util')

module.exports = {
  command: 'publishRaw <namespace> <statementBodyId>',
  description: 'Publish a statement whose body (actual metadata content) has ' +
    'already been stored in the node.  `statementBodyId` should be the multihash ' +
    'identifier of the statement body.\n',

  handler: subcommand((opts: {client: RestClient, namespace: string, statementBodyId: string}) => {
    const {client, namespace, statementBodyId} = opts

    return client.publish({namespace}, {object: statementBodyId})
      .then(objectIds => objectIds.forEach(println))
  })
}
