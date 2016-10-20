// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'query <queryString>',
  builder: {
    remotePeer: {
      description: 'the id of a remote peer to route the query to',
      alias: 'r'
    }
  },
  description: 'send a mediachain query to the node for evaluation.\n',
  handler: (opts: {peerUrl: string, queryString: string, remotePeer?: string}) => {
    const {peerUrl, queryString, remotePeer} = opts

    const client = new RestClient({peerUrl})
    client.queryStream(queryString, remotePeer)
      .then(response => {
        response.stream().on('data', printValue)
      })
      .catch(err => console.error(err.message))
  }
}

function printValue (obj: Object) {
  console.dir(obj, {colors: true, depth: 100})
}
