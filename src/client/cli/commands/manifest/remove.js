// @flow

const fs = require('fs')
const _ = require('lodash')
const RestClient = require('../../../api/RestClient')
const { subcommand, println } = require('../../util')
const { consumeStream } = require('../../../../common/util')

module.exports = {
  command: 'remove [filename]',
  description: 'Remove a signed manifest from the local node. ' +
  'If `filename` is not given, will read from standard input.\n',
  handler: subcommand((opts: {client: RestClient, filename?: string}) => {
    const {client, filename} = opts
    let streamName = 'standard input'
    let inputStream = process.stdin
    if (filename != null) {
      streamName = filename
      inputStream = fs.createReadStream(filename)
    }

    let manifest: Object

    return consumeStream(inputStream)
      .catch(err => {
        throw new Error(`Error reading from ${streamName}: ${err.message}`)
      })
      .then(contents => {
        manifest = JSON.parse(contents)
      })
      .then(() => client.getManifests())
      .then(manifests => {
        const without = _.filter(manifests, m => !_.isEqual(m, manifest))
        if (without.length === manifests.length) {
          println('Node does not contain manifest, ignoring')
          return
        }
        return client.setManifests(...without)
          .then(() => {
            println('Manifest removed successfully')
          })
      })
  })
}
