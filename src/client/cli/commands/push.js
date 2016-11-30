// @flow

const RestClient = require('../../api/RestClient')
const { subcommand, pluralizeCount } = require('../util')

module.exports = {
  command: 'push <remotePeer> <queryString>',
  description: 'Push statements and their referenced objects that match `query` to ' +
  '`remotePeer` from the local node.  The local node must be authorized with the remote ' +
  ' peer for the namespaces you are pushing to. \n',
  handler: subcommand((opts: {client: RestClient, queryString: string, remotePeer: string}) => {
    const {client, queryString, remotePeer} = opts

    return client.push(queryString, remotePeer)
      .then(({statementCount, objectCount}) => {
        console.log(
          `Pushed ${pluralizeCount(statementCount, 'statement')} and ${pluralizeCount(objectCount, 'object')}`
        )
      })
  })
}

