// @flow

const { clone, set } = require('lodash')
const fs = require('fs')
const Multihash = require('multihashes')
const { JQ_PATH } = require('../../metadata/jqStream')
const childProcess = require('child_process')
const sshTunnel = require('tunnel-ssh')
const { RestClient } = require('../api')

function formatJSON (obj: ?mixed,
                    options: {color?: ?boolean, pretty?: boolean} = {}): string {
  const compactOutput = options.pretty === false

  let useColor = false
  // print in color if explicitly enabled, or if pretty-printing to a tty
  if (options.color === true || (options.color == null && process.stdout.isTTY && !compactOutput)) {
    useColor = true
  }

  if (!useColor && compactOutput) {
    // skip jq if we don't want color or pretty printing
    return JSON.stringify(obj) + '\n'
  }

  const jqOpts = [(useColor ? '-C' : '-M'), '-a', '.']
  if (options.pretty === false) {
    jqOpts.unshift('-c')
  }

  return childProcess.execFileSync(JQ_PATH, jqOpts, {input: JSON.stringify(obj), encoding: 'utf-8'}).toString()
}

function printJSON (obj: ?mixed,
                    options: {color?: ?boolean, pretty?: boolean} = {}) {
  process.stdout.write(formatJSON(obj, options))
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

function ensureAll (obj: Object, keys: Array<string>, description: string = 'object') {
  for (const key of keys) {
    if (obj[key] === undefined) {
      throw new Error(`${description} is missing required field ${key}`)
    }
  }
}

function ensureAny (obj: Object, keys: Array<string>, description: string = 'object') {
  for (const key of keys) {
    if (obj[key] !== undefined) return
  }
  throw new Error(`${description} must have one of the following fields: ${keys.join(', ')}`)
}

function prepareSSHConfig (config: Object | string): Object {
  if (typeof config === 'string') {
    config = JSON.parse(fs.readFileSync(config, 'utf8'))
  }

  ensureAll(config, ['host', 'username'], 'SSH configuration')
  ensureAny(config, ['password', 'privateKey'], 'SSH configuration')

  const defaultOpts = {
    dstPort: '9002',
    localHost: 'localhost',
    keepAlive: true
  }

  return Object.assign({}, defaultOpts, config)
}

type GlobalOptions = {
  apiUrl: string,
  sshConfig?: string | Object,
  timeout: number
}

type SubcommandGlobalOptions = { // eslint-disable-line no-unused-vars
  client: RestClient
}

function subcommand<T: SubcommandGlobalOptions> (handler: (argv: T) => Promise<*>): (argv: GlobalOptions) => void {
  return (argv: GlobalOptions) => {
    const {apiUrl, sshConfig, timeout} = argv
    const client = new RestClient({apiUrl, requestTimeout: timeout})

    const sshTunnelConfig = (sshConfig != null)
      ? prepareSSHConfig(sshConfig)
      : null

    let sshTunnelPromise
    let sshTunnel = null
    if (sshTunnelConfig != null) {
      sshTunnelPromise = setupSSHTunnel(sshTunnelConfig)
        .then(tunnel => { sshTunnel = tunnel })
    } else {
      sshTunnelPromise = Promise.resolve()
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
        console.error(err.message)
        process.exit(1)
      })
  }
}

module.exports = {
  formatJSON,
  printJSON,
  pluralizeCount,
  isB58Multihash,
  subcommand,
  prepareSSHConfig
}
