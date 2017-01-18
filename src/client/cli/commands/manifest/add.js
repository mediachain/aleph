// @flow

const fs = require('fs')
const _ = require('lodash')
const RestClient = require('../../../api/RestClient')
const { subcommand, println } = require('../../util')
const { consumeStream } = require('../../../../common/util')

module.exports = {
  command: 'add [filename]',
  description: 'Add a signed manifest to the local node. ' +
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
        if (_.some(manifests, m => _.isEqual(m, manifest))) {
          println('Node already contains manifest, ignoring')
          return
        }
        manifests.push(manifest)
        return client.setManifests(...manifests)
          .then(() => {
            println('Manifest added successfully')
          })
      })
  })
}
