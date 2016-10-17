// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'getData <objectId>',
  description: 'request the object with objectId from the remote node and print to the console\n',

  handler: (opts: {peerUrl: string, objectId: string}) => {
    const {peerUrl, objectId} = opts
    const client = new RestClient({peerUrl})

    client.getData(objectId)
      .then(
        obj => console.log(JSON.stringify(obj)),
        err => console.error(err.message)
      )
  }
}
