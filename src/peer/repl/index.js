// @flow

const os = require('os')
// TODO: for bonus points, specify this as option, too
const home = os.homedir() + '/.mediachain/aleph/'

require('yargs')
  .usage('Usage: $0 [options] <command> [command-options]')
  .help()
  .example('$0 repl', 'start the aleph repl')
  .demand(1, 'Missing command argument')
  .commandDir('commands')
  .options({
    'config': {
      // this is the only way to get useful config in subcommands
      'config': true,
      'global': true,
      'default': home + 'config.json'
    },
    'identityPath': {
      'global': true,
      'default': home + 'identity.node'
    },
    'parentConcat': {
      'global': true,
      'type': 'string',
      'describe': 'The concat instance to pair with'
    }
  })
  .argv
