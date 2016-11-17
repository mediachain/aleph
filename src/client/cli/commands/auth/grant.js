// @flow

const RestClient = require('../../../api/RestClient')
const { printJSON } = require('../../util')

module.exports = {
  command: 'grant <peerId> <namespaces>',
  description: 'Set the list of namespaces that a given peer can push to. ' +
    'This will replace any existing authorizations. ' +
    "Namespaces may include wildcards, e.g. 'images.*'\n",
  builder: (yargs: Object) => yargs
    .example('$0 auth grant QmZtSnkmB9DkKJ1L4V65XZZAJC2GyCdge7x2cGn9Z9NTBs images.dpla museums.*'),
  handler: (opts: {apiUrl: string, peerId: string, namespaces: string, _: Array<string>}) => {
    const {apiUrl, peerId} = opts

    // This is an ugly hack to work around yargs unfortunate handling of
    // positional args in subcommands... the `opts._` array includes
    // the 'auth' and 'set' subcommand strings
    const additionalNamespaces = opts._.slice(2, opts._.length)
    const namespaces = [opts.namespaces].concat(additionalNamespaces)

    const client = new RestClient({apiUrl})
    client.authorize(peerId, namespaces)
      .then(() => client.getAuthorizations())
      .then(auths => {
        console.log(`Granted authorizations for peer ${peerId}:`)
        printJSON(auths[peerId])
      })
      .catch(err => console.error(err.message))
  }
}
