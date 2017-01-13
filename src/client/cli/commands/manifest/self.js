// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, println } = require('../../util')

module.exports = {
  command: 'self',
  description: `Get the unsigned "node manifest" for the local node, ` +
    `suitable for signing by mcid to produce a manifest.\n`,
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts
    return client.getSelfManifest()
      .then(m => println(m))
  })
}
