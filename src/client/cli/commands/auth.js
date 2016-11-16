// @flow

const path = require('path')

module.exports = {
  command: 'auth <subcommand>',
  description: 'Display and edit the set of peers authorized to push data to the local node.\n',
  builder: (yargs: Object) => yargs
    .commandDir(path.join(__dirname, 'auth'))
    .help()
    .strict(),

  handler: () => {}
}
