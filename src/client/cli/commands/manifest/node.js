// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, println } = require('../../util')

module.exports = {
  command: 'node',
  description: `Get the "node manifest" for the local node, suitable for signing by mcid to produce a manifest.\n`,
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts
    return client.getNodeManifest()
      .then(m => println(m))
  })
}
