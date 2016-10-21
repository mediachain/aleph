// @flow

const RestClient = require('../../api/RestClient')
const { pluralizeCount } = require('../util')

module.exports = {
  command: 'delete <queryString>',
  description: 'send a delete query to the node to delete matching statements.\n',
  handler: (opts: {apiUrl: string, queryString: string}) => {
    const {apiUrl, queryString} = opts

    const client = new RestClient({apiUrl})
    client.delete(queryString)
      .then(count => {
        console.log(`Deleted ${pluralizeCount(count, 'statement')}`)
      })
      .catch(err => console.error(err.message))
  }
}
