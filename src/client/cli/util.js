// @flow

const fs = require('fs')
const Multihash = require('multihashes')
const { JQ_PATH } = require('../../metadata/jqStream')
const childProcess = require('child_process')
const sshTunnel = require('tunnel-ssh')
const yaml = require('js-yaml')
const { RestClient } = require('../api')

function printJSON (obj: Object,
                    options: {color?: ?boolean, pretty?: boolean} = {}) {
  const compactOutput = options.pretty === false

  let useColor = false
  // print in color if explicitly enabled, or if pretty-printing to a tty
  if (options.color === true || (options.color == null && process.stdout.isTTY && !compactOutput)) {
    useColor = true
  }

  if (!useColor && compactOutput) {
    // skip jq if we don't want color or pretty printing
    console.log(JSON.stringify(obj))
    return
  }

  const jqOpts = [(useColor ? '-C' : '-M'), '-a', '.']
  if (options.pretty === false) {
    jqOpts.unshift('-c')
  }

  const output = childProcess.execFileSync(JQ_PATH, jqOpts, {input: JSON.stringify(obj), encoding: 'utf-8'})
  process.stdout.write(output)
}

function pluralizeCount (count: number, word: string): string {
  let plural = word
  if (count !== 1) plural += 's'
  return count.toString() + ' ' + plural
}

function isB58Multihash (str: string): boolean {
  try {
    Multihash.fromB58String(str)
    return true
  } catch (err) {
    return false
  }
}

function setupSSHTunnel(config: Object): Promise<Object> {
  return new Promise((resolve, reject) => {
    sshTunnel(config, (err, server) => {
      if (err) return reject(err)
      resolve(server)
    })
  })
}

function sshTunnelFromDeployCredentialsFile (filePath: string): Promise<Object> {
  const creds = loadDeployCredentials(filePath)
  const config = deployCredsToTunnelConfig(creds)
  return setupSSHTunnel(config)
}

function loadDeployCredentials (filePath: string): Object {
  if (filePath.endsWith('.yaml')) {
    return yaml.safeLoad(fs.readFileSync(filePath, 'utf8'))
  } else if (filePath.endsWith('.json')) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } else {
    throw new Error('Loading deploy credentials is only supported from .json or .yaml files')
  }
}

function deployCredsToTunnelConfig (deployCreds: Object | string, extraConfigOptions = {}): Object {
  if (typeof deployCreds === 'string') {
    deployCreds = loadDeployCredentials(deployCreds)
  }
  const {ip: host, vps_user: {name: username, password}} = deployCreds
  if (host == null || username == null || password == null) {
    throw new Error('Deploy credentials are in unexpected format')
  }
  const opts = {
    username,
    password,
    host,
    dstPort: '9002',
    localHost: 'localhost',
    keepAlive: true
  }
  return Object.assign({}, opts, extraConfigOptions)
}

type GlobalOptions = {
  apiUrl: string,
  sshTunnelConfig?: Object
}

type SubcommandGlobalOptions = {
  client: RestClient
}

function subcommand (handler: (argv: SubcommandGlobalOptions) => Promise<*>): (argv: GlobalOptions) => void {
  return (argv: GlobalOptions) => {
    const {apiUrl, sshTunnelConfig} = argv
    const client = new RestClient({apiUrl})

    let sshTunnelPromise = Promise.resolve()
    let sshTunnel = null
    if (sshTunnelConfig != null) {
      sshTunnelPromise = setupSSHTunnel(sshTunnelConfig)
        .then(tunnel => { sshTunnel = tunnel })
    }

    function closeTunnel () {
      if (sshTunnel != null) {
        sshTunnel.close()
      }
    }

    const subcommandOptions = Object.assign({}, argv, {client})

    sshTunnelPromise
      .then(() => handler(subcommandOptions))
      .then(closeTunnel)
      .catch(err => {
        closeTunnel()
        throw err
      })
  }
}

module.exports = {
  printJSON,
  pluralizeCount,
  isB58Multihash,
  subcommand,
  deployCredsToTunnelConfig,
  sshTunnelFromDeployCredentialsFile
}
