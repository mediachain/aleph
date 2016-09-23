// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'publish <namespace> <statement>',
  description: 'publish a statement',

  handler: (opts: {namespace: string, peerUrl: string, statement: string}) => {
    const {namespace, peerUrl, statement} = opts
    const client = new RestClient({peerUrl})

    client.publish(namespace, {object: statement})
      .then(
        console.log,
        err => console.error(err.message)
      )
  }
}
