// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, println, pluralizeCount } = require('../../util')

module.exports = {
  command: 'dir [dirIds..]',
  description: 'Get or set the directory servers.\n',
  builder: {
    clear: {
      type: 'boolean',
      description: 'If given, clear out the existing directory configuration.\n'
    }
  },
  handler: subcommand((opts: {client: RestClient, dirIds: Array<string>, clear?: boolean}) => {
    const {client, dirIds, clear} = opts

    if (clear) {
      return client.setDirectoryIds()
        .then(() => println('Directory configuration cleared'))
    }

    if (dirIds.length > 0) {
      return client.setDirectoryIds(...dirIds)
        .then(() => {
          println(`Set ${pluralizeCount(dirIds.length, 'directory server')}:`)
          dirIds.forEach(println)
        })
    }

    return client.getDirectoryIds()
      .then(ids => ids.forEach(println))
  })
}
