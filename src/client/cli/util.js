// @flow

const { clone, set } = require('lodash')
const fs = require('fs')
const Multihash = require('multihashes')
const { JQ_PATH } = require('../../metadata/jqStream')
const childProcess = require('child_process')
const sshTunnel = require('tunnel-ssh')
const { RestClient } = require('../api')
import type { Writable } from 'stream'
import type { WriteStream } from 'tty'

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
    dstPort: 9002,
    localPort: 0,
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
    const {sshConfig, timeout} = argv
    let {apiUrl} = argv

    const sshTunnelConfig = (sshConfig != null)
      ? prepareSSHConfig(sshConfig)
      : null

    let sshTunnelPromise
    let sshTunnel = null
    if (sshTunnelConfig != null) {
      sshTunnelPromise = setupSSHTunnel(sshTunnelConfig)
        .then(tunnel => {
          sshTunnel = tunnel
          const addr = sshTunnel.address()
          apiUrl = `http://${addr.address}:${addr.port}`
        })
    } else {
      sshTunnelPromise = Promise.resolve()
    }

    function closeTunnel () {
      if (sshTunnel != null) {
        sshTunnel.close()
      }
    }

    sshTunnelPromise
      .then(() => {
        const client = new RestClient({apiUrl, requestTimeout: timeout})
        return set(clone(argv), 'client', client)
      })
      .then(subcommandOptions => handler(subcommandOptions))
      .then(closeTunnel)
      .catch(err => {
        closeTunnel()
        console.error(err.message)
        process.exit(1)
      })
  }
}

/**
 * Print `output` to the `destination` stream and append a newline.
 * @param output
 * @param destination
 */
function writeln (output: string, destination: Writable | WriteStream) {
  destination.write(output + '\n')
}

/**
 * Print `output` to stdout and append a newline.
 * Always use this instead of console.log for non-debug output!
 * console.log keeps a strong reference to whatever you pass in,
 * which can result in memory leaks for long-running processes.
 * @param output
 */
function println (output: string) {
  writeln(output, process.stdout)
}

/**
 * Print `output` to stderr and append a newline.
 * Use if you don't want console.error to keep a strong reference
 * to whatever you pass in.
 * @param output
 */
function printlnErr (output: string) {
  writeln(output, process.stderr)
}

module.exports = {
  println,
  printlnErr,
  formatJSON,
  printJSON,
  pluralizeCount,
  isB58Multihash,
  subcommand,
  prepareSSHConfig
}
