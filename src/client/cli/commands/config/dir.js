// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, println, pluralizeCount } = require('../../util')

module.exports = {
  command: 'dir [dirIds..]',
  description: 'Get or set the directory servers.\n',
  handler: subcommand((opts: {client: RestClient, dirIds: Array<string>}) => {
    const {client, dirIds} = opts
    if (dirIds.length > 0) {
      return client.setDirectoryIds(...dirIds)
        .then(() => {
          println(`Set ${pluralizeCount(dirIds.length, 'directory server')}:`)
          dirIds.forEach(println)
        })
    } else {
      return client.getDirectoryIds()
        .then(ids => ids.forEach(println))
    }
  })
}
