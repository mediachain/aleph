// @flow

const path = require('path')

module.exports = {
  command: 'config <subcommand>',
  describe: 'show and set node configuration. use "config --help" to see subcommands',
  builder: (yargs: Function) => {
    return yargs
      .commandDir(path.join(__dirname, './config'))
      .help()
  },
  handler: () => {}
}
