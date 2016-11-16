// @flow

const RestClient = require('../../../api/RestClient')
const { printJSON } = require('../../util')

module.exports = {
  command: 'set <peerId> <namespaces>',
  description: 'Set the list of namespaces (including wildcards) that a given peer can push to.\n',
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
        console.log(`Set authorizations for peer ${peerId}:`)
        printJSON(auths[peerId])
      })
      .catch(err => console.error(err.message))
  }
}
