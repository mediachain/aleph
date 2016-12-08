// @flow

const RestClient = require('../../../api/RestClient')
const { printJSON, subcommand } = require('../../util')

module.exports = {
  command: 'get <objectIds..>',
  description: 'Request one or more `objectIds` from the local node and print to the console.\n',
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

  handler: subcommand((opts: {client: RestClient, objectIds: Array<string>, color: ?boolean, pretty: boolean}) => {
    const {client, objectIds, color, pretty} = opts
    const printObject = objectPrinter(color, pretty)
    return client.batchGetDataStream(objectIds)
      .then(
        stream => new Promise((resolve, reject) => {
          stream.on('data', printObject)
          stream.on('error', reject)
          stream.on('end', resolve)
        })
      )
  })
}

const objectPrinter = (color: ?boolean, pretty: boolean) => (obj: Buffer | Object) => {
  if (obj instanceof Buffer) {
    console.log(obj.toString('base64'))
  } else {
    printJSON(obj, {color, pretty})
  }
}
