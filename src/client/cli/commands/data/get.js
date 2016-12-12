// @flow

const RestClient = require('../../../api/RestClient')
const { formatJSON, subcommand } = require('../../util')
import type { Readable as ReadableStream } from 'stream'

module.exports = {
  command: 'get <objectIds..>',
  description: 'Request one or more `objectIds` from the local node and print to the console.' +
    'If multiple ids are given and pretty-printing is enabled, results will be returned as a JSON map, ' +
    'with `objectIds` as keys.\n',
  builder: {
    color: {
      type: 'boolean',
      description: 'Explicitly enable (or disable, with --no-color) colorized output.\n',
      default: null,
      defaultDescription: 'Print in color if stdout is a tty, and monochrome if piped or pretty-printing is disabled.'
    },
    pretty: {
      type: 'boolean',
      description: 'Pretty print the output.\n',
      default: true,
      defaultDescription: 'True.  Use --no-pretty for compact output.'
    },
    batch: {
      type: 'boolean',
      description: 'Force "batch-mode", even if only one key is given.  Disables color and pretty-printing.\n',
      default: false
    }
  },

  handler: subcommand((opts: {client: RestClient, objectIds: Array<string>, color: ?boolean, pretty: boolean, batch: boolean}) => {
    const {client, objectIds, batch} = opts
    let {color, pretty} = opts
    if (batch) {
      color = false
      pretty = false
    }

    if (!batch && objectIds.length === 1) {
      return client.getData(objectIds[0])
        .then(objectFormatter(color, pretty))
        .then(output => process.stdout.write(output))
    }

    return client.batchGetDataStream(objectIds)
      .then(stream => {
        if (pretty) {
          return printStreamPretty(stream, objectIds, color)
        } else {
          return printStreamCompact(stream)
        }
      })
  })
}

function printStreamCompact (stream: ReadableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    const formatObject = objectFormatter(false, false)
    const {stdout} = process
    stream.on('data', obj => {
      stdout.write(formatObject(obj))
    })
    stream.on('end', resolve)
    stream.on('error', reject)
  })
}

function printStreamPretty (stream: ReadableStream, objectIds: Array<string>, color: ?boolean, wrap: boolean = true): Promise<void> {
  const formatObject = objectFormatter(color, true)
  const {stdout} = process
  const padding = wrap ? 2 : 0
  if (wrap) {
    stdout.write('{\n')
  }
  return new Promise((resolve, reject) => {
    stream.on('data', result => {
      const key = objectIds.pop()
      const keyString = formatObject(key).trim()
      const formatted = formatObject(result).trim()
      const output = indent(`${keyString}: ${formatted}`, padding)
      stdout.write(output)

      if (wrap && objectIds.length > 0) {
        stdout.write(',')
      }
      stdout.write('\n')
    })
    stream.on('error', (err) => {
      if (wrap) {
        stdout.write(`}\n`)
      }
      reject(err)
    })
    stream.on('end', () => {
      if (wrap) {
        stdout.write(`}\n`)
      }
      resolve()
    })
  })
}

const objectFormatter = (color: ?boolean, pretty: boolean) => (obj: ?mixed): string => {
  if (obj instanceof Buffer) {
    obj = obj.toString('base64')
  }

  return formatJSON(obj, {color, pretty})
}

function indent (s: string, spaces: number = 2): string {
  const padding = new Array(spaces).fill(' ').join('')
  return s.split('\n').map(line => padding + line).join('\n')
}
