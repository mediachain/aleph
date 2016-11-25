// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand } = require('../../util')

module.exports = {
  command: 'dir [dirId]',
  description: 'Get or set the directory server id.\n',
  handler: subcommand((opts: {client: RestClient, dirId?: string}) => {
    const {client, dirId} = opts
    if (dirId) {
      return client.setDirectoryId(dirId)
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
  })
}
