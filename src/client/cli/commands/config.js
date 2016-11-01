// @flow

const path = require('path')

module.exports = {
  command: 'config <subcommand>',
  describe: 'Show and set local node configuration. Use "config --help" to see subcommands.\n',
  builder: (yargs: Function) => {
    return yargs
      .commandDir(path.join(__dirname, './config'))
      .help()
  },
  handler: () => {}
}
