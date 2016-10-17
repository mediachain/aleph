// @flow

const fs = require('fs')
const ndjson = require('ndjson')
const getIn = require('lodash.get')
const RestClient = require('../../api/RestClient')
import type { Readable } from 'stream'
import type { SimpleStatementMsg } from '../../../protobuf/types'

const BATCH_SIZE = 1000

type HandlerOptions = {
  namespace: string,
  peerUrl: string,
  idSelector: string,
  contentSelector: ?string,
  filename: ?string,
  batchSize: number}

module.exports = {
  command: 'publish <namespace> [filename]',
  description: 'publish a batch of statements from a batch of newline-delimited json. ' +
    'statements will be read from `filename` or stdin.\n',
  builder: {
    batchSize: { default: BATCH_SIZE },
    contentSelector: {
      description: 'If present, use as a keypath to select a subset of the data to publish. ' +
        'If contentSelector is used, idSelector should be relative to it, not to the content root.'
    },
    idSelector: {
      description: '`a dot-separated path to a field containing a well-known identifier, ' +
      'or, a string containing a JSON array of keys.  Use the latter if your keys contain "."\n'
    }
  },

  handler: (opts: HandlerOptions) => {
    const {namespace, peerUrl, batchSize, filename} = opts
    const idSelector = (opts.idSelector != null) ? parseSelector(opts.idSelector) : null
    const contentSelector = (opts.contentSelector != null) ? parseSelector(opts.contentSelector) : null
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
    const publishPromises: Array<Promise<*>> = []

    inputStream.pipe(ndjson.parse())
      .on('data', obj => {
        if (contentSelector != null) {
          obj = getIn(obj, contentSelector)
        }

        const refs = []
        if (idSelector != null) {
          const ref = getIn(obj, idSelector)
          if (ref !== undefined) refs.push(ref)
        }
        const tags = [] // TODO: support extracting tags
        const stmt = {object: obj, refs, tags}

        statementBodies.push(obj)
        statements.push(stmt)

        if (statementBodies.length >= batchSize) {
          publishPromises.push(
            publishBatch(client, namespace, statementBodies, statements)
          )
          statementBodies = []
          statements = []
        }
      })
      .on('error', err => console.error(`Error reading from ${streamName}: `, err))
      .on('end', () => {
        Promise.all(publishPromises)
          .then(() => {
            console.log('All statements published successfully')
          })
      })
  }
}

function publishBatch (client: RestClient, namespace: string, statementBodies: Array<Object>, statements: Array<Object>): Promise<*> {
  // save the refs for printing to the console on completion:
  const statementRefs = statements.map(s => s.refs)

  return client.putData(...statementBodies)
    .then(bodyHashes => {
      if (bodyHashes.length !== statements.length) {
        throw new Error(`Expected ${statements.length} results from putting data blobs, received ${bodyHashes.length}`)
      }
      statements = statements.map((s, i) => {
        s.object = bodyHashes[i]
        return s
      })

      return client.publish(namespace, ...statements)
        .then(statementIds => [bodyHashes, statementIds])
    })
    .then(([bodyHashes, statementIds]) => {
      if (bodyHashes.length !== statementIds.length) {
        throw new Error(`Number of statement bodies written (${bodyHashes.length}) does not match ` +
          `number of statements published (${statementIds.length})`)
      }

      for (let i = 0; i < bodyHashes.length; i++) {
        const refsString = JSON.stringify(statementRefs[i])
        console.log(`statement id: ${statementIds[i]} -- body: ${bodyHashes[i]} -- refs: ${refsString}`)
      }
    })
    .catch(err => {
      console.error('Error publishing statements: ', err)
    })
}

function parseSelector (selector: string): Array<string> {
  selector = selector.trim()
  if (selector.startsWith('[')) {
    return JSON.parse(selector).map(k => k.toString())
  }
  return selector.split('.')
}
