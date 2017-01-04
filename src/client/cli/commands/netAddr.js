// @flow

const RestClient = require('../../api/RestClient')
const { subcommand, println } = require('../util')

module.exports = {
  command: 'netAddr [peerId]',
  describe: `Print the local node's network addresses in multiaddr format. ` +
    `If 'peerId' is given, prints the locally known addresses for that peer (useful for debugging).\n`,
  handler: subcommand((opts: {client: RestClient, peerId?: string}) => {
    const {client, peerId} = opts

    return client.getNetAddresses(peerId)
      .then(
        addresses => {
          if (addresses.length < 1) {
            if (peerId != null) {
              println(`No known addresses for peer ${peerId}`)
            } else {
              println(
                'Local node does not have an address. Make sure status is set to "online" or "public"'
              )
            }
          } else {
            addresses.forEach(addr => {
              println(addr)
            })
          }
        })
      .catch(
        err => { throw new Error(`Error retrieving addresses: ${err.message}`) }
      )
  })
}
