// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'getData <objectId>',
  description: 'request the object with objectId from the remote node and print to the console\n',

  handler: (opts: {apiUrl: string, objectId: string}) => {
    const {apiUrl, objectId} = opts
    const client = new RestClient({apiUrl})

    client.getData(objectId)
      .then(
        obj => console.log(JSON.stringify(obj)),
        err => console.error(err.message)
      )
  }
}
