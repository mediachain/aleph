// @flow

const RestClient = require('../../api/RestClient')
const { printJSON } = require('../util')

module.exports = {
  command: 'statement <statementId>',
  description: 'Retrieve a statement from the local node by its id.\n',
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

  handler: (opts: {statementId: string, apiUrl: string, color: ?boolean, pretty: boolean}) => {
    const {statementId, apiUrl, color, pretty} = opts
    const client = new RestClient({apiUrl})

    client.statement(statementId)
      .then(
        obj => { printJSON(obj, {color, pretty}) },
        err => { console.error(err.message) }
      )
  }
}
