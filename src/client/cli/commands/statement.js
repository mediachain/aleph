// @flow

const RestClient = require('../../api/RestClient')
const { subcommand, printJSON } = require('../util')

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

  handler: subcommand((opts: {client: RestClient, statementId: string, color: ?boolean, pretty: boolean}) => {
    const {client, statementId, color, pretty} = opts

    return client.statement(statementId)
      .then(
        obj => { printJSON(obj, {color, pretty}) },
        err => { console.error(err.message) }
      )
  })
}
