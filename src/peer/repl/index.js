// @flow

const os = require('os')
const path = require('path')
const mkdirp = require('mkdirp')
// TODO: for bonus points, specify this as option, too
const home = path.join(os.homedir(), '.mediachain', 'aleph')

function ensureDirExists (filePath: string, fileDescription = 'file') {
  const basedir = path.dirname(filePath)
  try {
    mkdirp.sync(basedir)
  } catch (err) {
    throw new Error(
      `Unable to create parent directory for ${fileDescription} at ${filePath}: ${err.message}`)
  }
  return filePath
}

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
      'default': path.join(home, 'config.json')
    },
    'identityPath': {
      'global': true,
      'default': path.join(home, 'identity.node')
    },
    'remotePeer': {
      'global': true,
      'type': 'string',
      'describe': 'The remote peer to pair with (multiaddress)'
    }
  })
  .coerce('config', filePath => ensureDirExists(filePath, 'config file'))
  .coerce('identityPath', filePath => ensureDirExists(filePath, 'identity file'))
  .argv
