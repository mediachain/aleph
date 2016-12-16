// @flow

const RestClient = require('../../api/RestClient')
const { subcommand, pluralizeCount, println } = require('../util')

module.exports = {
  command: 'delete <queryString>',
  description: 'Send a delete query to the local node to delete matching statements.\n',
  handler: subcommand((opts: {client: RestClient, queryString: string}) => {
    const {client, queryString} = opts

    return client.delete(queryString)
      .then(count => {
        println(`Deleted ${pluralizeCount(count, 'statement')}`)
      })
  })
}
