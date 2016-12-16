// @flow

const RestClient = require('../../api/RestClient')
const { subcommand, println } = require('../util')

module.exports = {
  command: 'netConnections',
  describe: `Print a list of all actively connected peers (useful for debugging).\n`,
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts

    return client.getNetConnections()
      .then(
        addresses => {
          if (addresses.length < 1) {
            println(
              'No active network connections.  Is the node online?'
            )
          } else {
            addresses.forEach(addr => {
              println(addr)
            })
          }
        })
      .catch(
        err => { throw new Error(`Error retrieving network connection list: ${err.message}`) }
      )
  })
}
