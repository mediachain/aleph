// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'merge <remotePeer> <queryString>',
  description: 'send a mediachain query to the node for evaluation.\n',
  handler: (opts: {peerUrl: string, queryString: string, remotePeer: string}) => {
    const {peerUrl, queryString, remotePeer} = opts

    const client = new RestClient({peerUrl})
    client.merge(queryString, remotePeer)
      .then(({statementCount, objectCount}) => {
        console.log(`merged ${statementCount} statements and ${objectCount} objects`)
      })
      .catch(err => console.error(err.message))
  }
}

function printValue (obj: Object) {
  console.dir(obj, {colors: true, depth: 100})
}
