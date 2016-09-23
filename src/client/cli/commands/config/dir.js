// @flow

const RestClient = require('../../../api/RestClient')

module.exports = {
  command: 'dir [dirId]',
  description: 'get or set the directory server id',
  handler: (opts: {peerUrl: string, dirId?: string}) => {
    const {peerUrl, dirId} = opts
    const client = new RestClient({peerUrl})
    if (dirId) {
      client.setDirectoryId(dirId)
        .then(() => {
          console.log(`set directory to ${dirId}`)
        })
    } else {
      return client.getDirectoryId()
        .then(
          console.log,
          err => console.error(err.message)
        )
    }
  }
}
