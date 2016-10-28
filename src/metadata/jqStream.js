// @flow

const childProcess = require('child_process')
const byline = require('byline')
import type { Readable } from 'stream'

function jqStream (filter: string, inputStream: Readable): Readable {
  // TODO(important): escape filter to prevent shell attacks

  const args = [
    '-c', // compact (no pretty print)
    '-M', // monochrome output
    '-S', // sort object keys
    filter
  ]
  const jq = childProcess.spawn('jq', args, {encoding: 'utf-8'})
  jq.stdout.setEncoding('utf-8')
  jq.stderr.setEncoding('utf-8')

  const output = byline(jq.stdout)
  const stderr = byline(jq.stderr)
  inputStream.pipe(jq.stdin)

  stderr.on('data', err => { console.error('jq error: ', err) })

  return output
}

module.exports = {
  jqStream
}
