// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'query [queryString]',
  description: 'send a mediachain query to the node for evaluation.',
  handler: (opts: {peerUrl: string, queryString: string}) => {
    const {peerUrl, queryString} = opts

    const client = new RestClient({peerUrl})
    client.query(queryString)
      .then(
        response => console.dir(response, {colors: true}),
        err => console.error(err.message)
      )
  }
}
