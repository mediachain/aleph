// @flow

const path = require('path')

module.exports = {
  command: 'net <subcommand>',
  description: 'Commands for inspecting and managing peer-to-peer network connections.\n',
  builder: (yargs: Object) => yargs
    .commandDir(path.join(__dirname, 'net'))
    .help()
    .strict(),

  handler: () => {}
}
