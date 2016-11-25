// @flow

const yargs = require('yargs')

const {deployCredsToTunnelConfig} = require('./util')

yargs
  .usage('Usage: $0 [options] <command> [command-options]')
  .help()
  .demand(1, 'Missing command argument')
  .option('apiUrl', {
    alias: ['p'],
    description: 'Root URL of the REST API for a mediachain node',
    default: 'http://localhost:9002'
  })
  .option('deployCredentialsFile', {
    coerce: deployCredsToTunnelConfig,
    alias: 'sshTunnelConfig'
  })
  .global('apiUrl')
  .global('sshTunnelConfig')
  .commandDir('commands')
  .strict()
  .wrap(yargs.terminalWidth())
  .argv

