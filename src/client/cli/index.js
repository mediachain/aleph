// @flow

const yargs = require('yargs')

const {sshTunnelFromDeployCredentialsFile} = require('./util')
let sshTunnel = null

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
    coerce: (filePath) => {
      if (sshTunnel != null) return filePath
      console.log('in coerce')
      sshTunnel = sshTunnelFromDeployCredentialsFile(filePath)
      return filePath
    },
    alias: 'sshTunnel'
  })
  .global('apiUrl')
  .global('sshTunnel')
  .commandDir('commands')
  .strict()
  .wrap(yargs.terminalWidth())
  .argv


if (sshTunnel != null) {
  sshTunnel.then(tunnel => {
    console.log('ssh tunnel setup, closing')
    tunnel.close()
  })
}
