// @flow

const fs = require('fs')
const RestClient = require('../../../api/RestClient')
const { subcommand, println } = require('../../util')
const { consumeStream } = require('../../../../common/util')

module.exports = {
  command: 'set [filename]',
  description: `Set the signed manifests for the local node, replacing any existing manifests. ` +
    'If `filename is not given, will read from stdin`\n',
  builder: {
    ndjson: {
      type: 'boolean',
      description: 'If present, input should be newline-delimited json, one object per line. ' +
        'Otherwise, input can be either a single json object, or an array of objects.',
      default: 'false'
    }
  },
  handler: subcommand((opts: {client: RestClient, filename?: string, ndjson: boolean}) => {
    const {client, filename, ndjson} = opts
    let streamName = 'standard input'
    let inputStream = process.stdin
    if (filename != null) {
      streamName = filename
      inputStream = fs.createReadStream(filename)
    }

    return consumeStream(inputStream)
      .catch(err => {
        throw new Error(`Error reading from ${streamName}: ${err.message}`)
      })
      .then(contents => {
        let manifests = []
        if (ndjson) {
          manifests = contents.split('\n')
            .filter(line => line && line.length > 0)
            .map(line => JSON.parse(line))
        } else {
          const parsed = JSON.parse(contents)
          if (Array.isArray(parsed)) {
            manifests = parsed
          } else {
            manifests = [parsed]
          }
        }
        return manifests
      })
      .then(manifests => client.setManifests(...manifests))
      .then(() => {
        println('Manifests set successfully')
      })
  })
}
