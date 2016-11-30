// @flow

const RestClient = require('../../api/RestClient')
const { subcommand, pluralizeCount } = require('../util')

module.exports = {
  command: 'merge <remotePeer> <queryString>',
  description: 'Merge statements and their referenced objects that match `query` from ' +
    '`remotePeer` into the local node.\n',
  handler: subcommand((opts: {client: RestClient, queryString: string, remotePeer: string}) => {
    const {client, queryString, remotePeer} = opts

    return client.merge(queryString, remotePeer)
      .then(({statementCount, objectCount}) => {
        console.log(
          `merged ${pluralizeCount(statementCount, 'statement')} and ${pluralizeCount(objectCount, 'object')}`
        )
      })
  })
}

