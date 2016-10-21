// @flow

const RestClient = require('../../api/RestClient')
const { pluralizeCount } = require('../util')

module.exports = {
  command: 'merge <remotePeer> <queryString>',
  description: 'send a mediachain query to the node for evaluation.\n',
  handler: (opts: {apiUrl: string, queryString: string, remotePeer: string}) => {
    const {apiUrl, queryString, remotePeer} = opts

    const client = new RestClient({apiUrl})
    client.merge(queryString, remotePeer)
      .then(({statementCount, objectCount}) => {
        console.log(
          `merged ${pluralizeCount(statementCount, 'statement')} and ${pluralizeCount(objectCount, 'object')}`
        )
      })
      .catch(err => console.error(err.message))
  }
}

