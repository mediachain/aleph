// @flow

require('yargs')
  .usage('Usage: $0 [options] <command> [command-options]')
  .help()
  .example('$0 repl', 'start the aleph repl')
  .demand(1, 'Missing command argument')
  .commandDir('commands')
  .argv
