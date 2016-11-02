// @flow

const RestClient = require('../../api/RestClient')

module.exports = {
  command: 'netAddress',
  describe: `Print the local node's network address in multiaddr format.`,
  handler: (opts: {apiUrl: string}) => {
    const {apiUrl} = opts

    const client = new RestClient({apiUrl})
    client.getNetAddress()
      .then(
        addr => {
          if (addr.length < 1) {
            console.warn(
              'Local node does not have an address. Make sure status is set to "online" or "public"'
            )
          } else {
            console.log(addr)
          }
        },
        err => console.error('error pinging: ', err.message)
      )
  }
}
