// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, printJSON, println } = require('../../util')

module.exports = {
  command: 'grant <peerId> <namespaces..>',
  description: 'Set the list of namespaces that a given peer can push to. ' +
    'This will replace any existing authorizations. ' +
    "Namespaces may include wildcards, e.g. 'images.*'\n",
  builder: (yargs: Object) => yargs
    .example('$0 auth grant QmZtSnkmB9DkKJ1L4V65XZZAJC2GyCdge7x2cGn9Z9NTBs images.dpla museums.*'),
  handler: subcommand((opts: {client: RestClient, peerId: string, namespaces: Array<string>}) => {
    const {client, peerId, namespaces} = opts

    return client.authorize(peerId, namespaces)
      .then(() => client.getAuthorizations())
      .then(auths => {
        println(`Granted authorizations for peer ${peerId}:`)
        printJSON(auths[peerId])
      })
  })
}
