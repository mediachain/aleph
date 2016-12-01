// @flow

const path = require('path')

module.exports = {
  command: 'data <subcommand>',
  describe: `Interact with the local node's datastore. Use "data --help" to see subcommands.\n`,
  builder: (yargs: Function) => {
    return yargs
      .commandDir(path.join(__dirname, './data'))
      .demand(1, 'Missing command argument')
      .help()
      .strict()
  },
  handler: () => {}
}
