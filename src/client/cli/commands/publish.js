// @flow

const fs = require('fs')
const ndjson = require('ndjson')
const getIn = require('lodash.get')
const RestClient = require('../../api/RestClient')
const cbor = require('cbor')
const mh = require('multihashing')
import type { Readable } from 'stream'
import type { SimpleStatementMsg } from '../../../protobuf/types'

const BATCH_SIZE = 1000

module.exports = {
  command: 'publish <namespace> <idSelector> [filename]',
  description: 'publish a batch of statements from a batch of newline-delimited json.\n' +
    'statements will be read from `filename` or stdin.\n' +
    '`idSelector` is a dot-separated path to a field containing a well-known identifier.',
  builder: {
    batchSize: { default: BATCH_SIZE }
  },

  handler: (opts: {namespace: string, peerUrl: string, idSelector: string, filename: ?string, batchSize: number}) => {
    const {namespace, peerUrl, idSelector, batchSize, filename} = opts
    const streamName = 'standard input'

    const client = new RestClient({peerUrl})

    let inputStream: Readable
    if (filename) {
      inputStream = fs.createReadStream(filename)
    } else {
      inputStream = process.stdin
    }

    let statementBodies: Array<Object> = []
    let statements: Array<SimpleStatementMsg> = []

    inputStream.pipe(ndjson.parse())
      .on('data', obj => {
        const ref = extractId(obj, idSelector)
        const refs = []
        if (ref) refs.push(ref)

        const tags = [] // TODO: support extracting tags

        const {encoded, multihash} = encode(obj)
        const stmt = {object: multihash, refs, tags}

        statementBodies.push(encoded)
        statements.push(stmt)

        if (statementBodies.length >= batchSize) {
          // put the data blobs and statement envelopes in parallel

          // save the refs for printing to the console on completion:
          const statementRefs = statements.map(s => s.refs)

          // first the bodies:
          const bodyPromise = client.putData(...statementBodies)
          statementBodies = []

          // now the statements:
          const statementPromise = client.publish(namespace, ...statements)
          statements = []

          // when both are complete, print some info to the console
          Promise.all([bodyPromise, statementPromise]).then(([bodyHashes, statementIds]) => {
            if (bodyHashes.length !== statementIds.length) {
              console.error(`Number of statement bodies written (${bodyHashes.length}) does not match ` +
                `number of statements published (${statementIds.length})`)
              return
            }

            for (let i = 0; i < bodyHashes.length; i++) {
              const refsString = JSON.stringify(statementRefs[i])
              console.log(`statement id: ${statementIds[i]} -- body: ${bodyHashes[i]} -- refs: ${refsString}`)
            }
          })
        }
      })
      .on('error', err => console.error(`Error reading from ${streamName}: `, err))
  }
}

function encode (body: Object): {encoded: Buffer, multihash: string} {
  const encoded = cbor.encode(body)
  const multihash = mh.multihash.toB58String(mh(encoded, 'sha2-256'))
  return {encoded, multihash}
}

function extractId (body: Object, idSelector: string): ?string {
  // TODO: allow keys with dots?  would require escaping, or accepting json array of keys
  return getIn(body, idSelector)
}
