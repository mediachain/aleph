// @flow

const RestClient = require('../../api/RestClient')
const { prettyPrint } = require('../util')

module.exports = {
  command: 'getData <objectId>',
  description: 'Request the object with `objectId` from the local node and print to the console.\n',

  handler: (opts: {apiUrl: string, objectId: string}) => {
    const {apiUrl, objectId} = opts
    const client = new RestClient({apiUrl})

    client.getData(objectId)
      .then(
        prettyPrint,
        err => console.error(err.message)
      )
  }
}
