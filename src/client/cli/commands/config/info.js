// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand } = require('../../util')

module.exports = {
  command: 'info [peerInfo]',
  description: 'Get or set the peer info message.\n',
  handler: subcommand((opts: {client: RestClient, peerInfo?: string}) => {
    const {client, peerInfo} = opts
    if (peerInfo) {
      return client.setInfo(peerInfo)
        .then(() => {
          console.log(`set peer info to "${peerInfo}"`)
        })
    } else {
      return client.getInfo()
        .then(console.log)
    }
  })
}
