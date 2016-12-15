// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, println } = require('../../util')

module.exports = {
  command: 'dir [dirId]',
  description: 'Get or set the directory server id.\n',
  handler: subcommand((opts: {client: RestClient, dirId?: string}) => {
    const {client, dirId} = opts
    if (dirId) {
      return client.setDirectoryId(dirId)
        .then(() => {
          println(`set directory to ${dirId}`)
        })
    } else {
      return client.getDirectoryId()
        .then(println)
    }
  })
}
