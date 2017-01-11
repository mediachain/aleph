// @flow

const { clone, set } = require('lodash')
const fs = require('fs')
const { JQ_PATH } = require('../../metadata/jqStream')
const childProcess = require('child_process')
const sshTunnel = require('tunnel-ssh')
const { RestClient } = require('../api')
const { println, printlnErr, isB58Multihash } = require('../../common/util')

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

function prepareSSHConfig (config: Object | string): Object {
  if (typeof config === 'string') {
    config = JSON.parse(fs.readFileSync(config, 'utf8'))
  }

  ensureAll(config, ['host', 'username'], 'SSH configuration')

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
          tunnel.on('error', err => {
            console.error(`SSH Error: ${err.message}`)
            tunnel.close()
            process.exit(1)
          })
          const addr = tunnel.address()

          sshTunnel = tunnel
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
