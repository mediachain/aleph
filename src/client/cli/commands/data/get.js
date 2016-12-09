// @flow

const RestClient = require('../../../api/RestClient')
const { formatJSON, subcommand } = require('../../util')
import type { Readable as ReadableStream } from 'stream'

module.exports = {
  command: 'get <objectIds..>',
  description: 'Request one or more `objectIds` from the local node and print to the console.' +
    'If multiple ids are given, results will be returned as a JSON map, with objectIds as keys.\n',
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
    }
  },

  handler: subcommand((opts: {client: RestClient, objectIds: Array<string>, color: ?boolean, pretty: boolean}) => {
    const {client, objectIds, color, pretty} = opts

    if (objectIds.length === 1) {
      return client.getData(objectIds[0])
        .then(objectFormatter(color, pretty))
        .then(output => process.stdout.write(output))
    }

    return client.batchGetDataStream(objectIds)
      .then(stream => printStream(stream, objectIds, color, pretty))
  })
}

function printStream (stream: ReadableStream, objectIds: Array<string>, color: ?boolean, pretty: boolean): Promise<void> {
  const formatObject = objectFormatter(color, pretty)
  const {stdout} = process
  stdout.write('{')
  if (pretty) {
    stdout.write('\n')
  }

  return new Promise((resolve, reject) => {
    const leftPad = pretty ? '  ' : ''
    stream.on('data', result => {
      const key = objectIds.pop()
      const keyString = formatObject(key).trim()
      const formatted = formatObject(result).trim()
        .split('\n')
        .map((s, i) => (i === 0) ? s : leftPad + s)
        .join('\n')

      stdout.write(`${leftPad}${keyString}: ${formatted}`)
      if (objectIds.length > 0) {
        stdout.write(',')
      }
      if (pretty) {
        stdout.write('\n')
      }
    })
    stream.on('error', (err) => {
      stdout.write(`}\n`)
      reject(err)
    })
    stream.on('end', () => {
      stdout.write(`}\n`)
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
