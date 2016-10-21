// @flow

const RestClient = require('../../api/RestClient')
const { prettyPrint } = require('../util')

module.exports = {
  command: 'query <queryString>',
  builder: {
    remotePeer: {
      description: 'the id of a remote peer to route the query to',
      alias: 'r'
    }
  },
  description: 'send a mediachain query to the node for evaluation.\n',
  handler: (opts: {apiUrl: string, queryString: string, remotePeer?: string}) => {
    const {apiUrl, queryString, remotePeer} = opts

    const client = new RestClient({apiUrl})
    client.queryStream(queryString, remotePeer)
      .then(response => {
        response.stream().on('data', prettyPrint)
      })
      .catch(err => console.error(err.message))
  }
}
