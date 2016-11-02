// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'netAddresses',
  describe: `Print the local node's network addresses in multiaddr format.`,
  handler: (opts: {apiUrl: string}) => {
    const {apiUrl} = opts

    const client = new RestClient({apiUrl})
    client.getNetAddresses()
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
  }
}
