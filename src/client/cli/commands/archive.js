// @flow

const path = require('path')

module.exports = {
  command: 'archive <subcommand>',
  description: 'Commands to create or load archives of mediachain statements & objects.\n',
  builder: (yargs: Object) => yargs
    .commandDir(path.join(__dirname, 'archive'))
    .help()
    .strict(),

  handler: () => {}
}
