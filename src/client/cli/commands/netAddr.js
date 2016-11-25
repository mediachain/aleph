// @flow

const RestClient = require('../../api/RestClient')
const { subcommand } = require('../util')

module.exports = {
  command: 'netAddr',
  describe: `Print the local node's network addresses in multiaddr format.\n`,
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts

    return client.getNetAddresses()
      .then(
        addresses => {
          if (addresses.length < 1) {
            console.warn(
              'Local node does not have an address. Make sure status is set to "online" or "public"'
            )
          } else {
            addresses.forEach(addr => {
              console.log(addr)
            })
          }
        },
        err => console.error('Error retrieving addresses: ', err.message)
      )
  })
}
