// @flow

const yargs = require('yargs')

yargs
  .usage('Usage: $0 [options] <command> [command-options]')
  .help()
  .demand(1, 'Missing command argument')
  .option('apiUrl', {
    alias: ['p'],
    description: 'Root URL of the REST API for a mediachain node',
    default: 'http://localhost:9002'
  })
  .option('sshConfig', {
    description: 'Path to a configuration file for SSH tunnelling, e.g. the credentials file created by Mediachain Deploy'
  })
  .global('apiUrl')
  .global('sshConfig')
  .global('timeout')
  .commandDir('commands')
  .strict()
  .wrap(yargs.terminalWidth())
  .argv

