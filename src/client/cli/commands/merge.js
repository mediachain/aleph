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
        console.log(`merged ${countString(statementCount, 'statement')} and ${countString(objectCount, 'object')}`)
      })
      .catch(err => console.error(err.message))
  }
}

function countString (count: number, word: string): string {
  let plural = word
  if (count !== 1) plural += 's'
  return count.toString() + ' ' + plural
}
