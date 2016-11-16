// @flow

const RestClient = require('../../api/RestClient')
const { pluralizeCount } = require('../util')

module.exports = {
  command: 'push <remotePeer> <queryString>',
  description: 'Push statements and their referenced objects that match `query` to ' +
  '`remotePeer` from the local node.  The local node must be authorized with the remote ' +
  ' peer for the namespaces you are pushing to. \n',
  handler: (opts: {apiUrl: string, queryString: string, remotePeer: string}) => {
    const {apiUrl, queryString, remotePeer} = opts

    const client = new RestClient({apiUrl})
    client.push(queryString, remotePeer)
      .then(({statementCount, objectCount}) => {
        console.log(
          `Pushed ${pluralizeCount(statementCount, 'statement')} and ${pluralizeCount(objectCount, 'object')}`
        )
      })
      .catch(err => console.error(err.message))
  }
}

