// @flow

const RestClient = require('../../api/RestClient')
const { printJSON } = require('../util')

module.exports = {
  command: 'getData <objectId>',
  description: 'Request the object with `objectId` from the local node and print to the console.\n',
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

  handler: (opts: {apiUrl: string, objectId: string, color: ?boolean, pretty: boolean}) => {
    const {apiUrl, objectId, color, pretty} = opts
    const client = new RestClient({apiUrl})

    client.getData(objectId)
      .then(
        obj => {
          if (obj instanceof Buffer) {
            console.log(obj.toString('base64'))
          } else {
            printJSON(obj, {color, pretty})
          }
        },
        err => console.error(err.message)
      )
  }
}
