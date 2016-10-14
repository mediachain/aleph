// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'publishRaw <namespace> <statementBodyId>',
  description: 'publish a statement whose body (actual metadata content) has \n' +
    'already been stored in the node.  `statementBodyId` should be the multihash \n' +
    'identifier of the statement body,',

  handler: (opts: {namespace: string, peerUrl: string, statementBodyId: string}) => {
    const {namespace, peerUrl, statementBodyId} = opts
    const client = new RestClient({peerUrl})

    client.publish(namespace, {object: statementBodyId})
      .then(
        console.log,
        err => console.error(err.message)
      )
  }
}
