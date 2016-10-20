// @flow

const RestClient = require('../../../api/RestClient')

module.exports = {
  command: 'info [peerInfo]',
  description: 'get or set the peer info message',
  handler: (opts: {peerUrl: string, peerInfo?: string}) => {
    const {peerUrl, peerInfo} = opts
    const client = new RestClient({peerUrl})
    if (peerInfo) {
      client.setInfo(peerInfo)
        .then(() => {
          console.log(`set peer info to "${peerInfo}"`)
        })
    } else {
      return client.getInfo()
        .then(
          console.log,
          err => console.error(err.message)
        )
    }
  }
}
