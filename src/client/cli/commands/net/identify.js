// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, printJSON } = require('../../util')

module.exports = {
  command: 'identify <peerId>',
  description: `Use the libp2p-identify protocol to get information about a peer and print in JSON format.\n`,
  builder: {
    color: {
      type: 'boolean',
      description: 'Explicitly enable (or disable, with --no-color) colorized output.\n',
      default: null,
      defaultDescription: 'Print in color if stdout is a tty, and monochrome if piped or pretty-printing is disabled.'
    },
    pretty: {
      type: 'boolean',
      description: 'Pretty print the output.\n',
      default: true,
      defaultDescription: 'True.  Use --no-pretty for compact output.'
    }
  },
  handler: subcommand((opts: {client: RestClient, peerId: string, color: ?boolean, pretty: boolean}) => {
    const {client, peerId, color, pretty} = opts

    return client.netIdentify(peerId)
      .then(info => {
        printJSON(info, {color, pretty})
      })
      .catch(
        err => { throw new Error(`Error retrieving network connection list: ${err.message}`) }
      )
  })
}
