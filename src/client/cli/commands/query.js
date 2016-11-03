// @flow

const RestClient = require('../../api/RestClient')
const { printJSON } = require('../util')

module.exports = {
  command: 'query <queryString>',
  builder: {
    remotePeer: {
      description: 'The id of a remote peer to route the query to.',
      alias: 'r'
    },
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
  description: 'Send a mediachain query to the local node or a remote peer for evaluation.\n',
  handler: (opts: {apiUrl: string, queryString: string, remotePeer?: string, pretty: boolean, color?: boolean}) => {
    const {apiUrl, queryString, remotePeer, pretty, color} = opts

    const client = new RestClient({apiUrl})
    client.queryStream(queryString, remotePeer)
      .then(response => {
        response.stream().on('data', result => {
          printJSON(result, {color, pretty})
        })
      })
      .catch(err => console.error(err.message))
  }
}
