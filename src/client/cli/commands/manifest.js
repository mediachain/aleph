// @flow

const path = require('path')

module.exports = {
  command: 'manifest <subcommand>',
  describe: 'Commands for setting and retrieving identity manifests. Use "manifest --help" to see subcommands.\n',
  builder: (yargs: Function) => {
    return yargs
      .commandDir(path.join(__dirname, './manifest'))
      .help()
      .strict()
  },
  handler: () => {}
}
