// @flow

const { clone, set } = require('lodash')
const fs = require('fs')
const Multihash = require('multihashes')
const { JQ_PATH } = require('../../metadata/jqStream')
const childProcess = require('child_process')
const sshTunnel = require('tunnel-ssh')
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

function setupSSHTunnel (config: Object): Promise<Object> {
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
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function deployCredsToTunnelConfig (deployCreds: Object | string, extraConfigOptions: Object = {}): Object {
  if (typeof deployCreds === 'string') {
    deployCreds = loadDeployCredentials(deployCreds)
  }
  const {host, username, password, privateKey} = deployCreds
  if (host == null || username == null || (password == null && privateKey == null)) {
    throw new Error('Deploy credentials are in unexpected format')
  }

  const opts: Object = {
    username,
    host,
    dstPort: '9002',
    localHost: 'localhost',
    keepAlive: true
  }

  if (privateKey) {
    opts.privateKey = privateKey
  } else {
    opts.password = password
  }

  return Object.assign({}, opts, extraConfigOptions)
}

type GlobalOptions = {
  apiUrl: string,
  deployCredentialsFile?: Object
}

type SubcommandGlobalOptions = { // eslint-disable-line no-unused-vars
  client: RestClient
}

function subcommand<T: SubcommandGlobalOptions> (handler: (argv: T) => Promise<*>): (argv: GlobalOptions) => void {
  return (argv: GlobalOptions) => {
    const {apiUrl, deployCredentialsFile} = argv
    const client = new RestClient({apiUrl})

    const sshTunnelConfig = (deployCredentialsFile != null)
      ? deployCredsToTunnelConfig(deployCredentialsFile)
      : null

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

    // Using lodash as a kind of flow "escape valve", since it's being stubborn
    const subcommandOptions: T = set(clone(argv), 'client', client)

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
