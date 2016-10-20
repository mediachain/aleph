// @flow

const fs = require('fs')
const ndjson = require('ndjson')
const objectPath = require('object-path')
const RestClient = require('../../api/RestClient')
import type { Readable } from 'stream'
import type { SimpleStatementMsg } from '../../../protobuf/types'

const BATCH_SIZE = 1000

type HandlerOptions = {
  namespace: string,
  apiUrl: string,
  idSelector: string,
  contentSelector: ?string,
  filename: ?string,
  batchSize: number,
  idRegex: ?string,
  contentFilters: ?string,
  dryRun: boolean
}

module.exports = {
  command: 'publish <namespace> [filename]',
  description: 'publish a batch of statements from a batch of newline-delimited json. ' +
    'statements will be read from `filename` or stdin.\n',
  builder: {
    batchSize: { default: BATCH_SIZE },
    idSelector: {
      required: true,
      description: 'a dot-separated path to a field containing a well-known identifier, ' +
      'or, a string containing a JSON array of keys.  Use the latter if your keys contain "."\n'
    },
    contentSelector: {
      description: 'If present, use as a keypath to select a subset of the data to publish. ' +
        'If contentSelector is used, idSelector should be relative to it, not to the content root.\n'
    },
    contentFilters: {
      description: 'Key-paths to omit from content. Multiple keypaths can be joined with ",". \n'
    },
    idRegex: {
      description: 'if present, any capture groups will be used to extract a portion of the id. ' +
        'e.g. --idRegex \'(dpla_)http.*/(.*)\' would turn ' +
        '"dpla_http://dp.la/api/items/2e49bf374b1b55f71603aa9aa326a9d6" into ' +
        '"dpla_2e49bf374b1b55f71603aa9aa326a9d6"\n'
    },
    dryRun: {
      type: 'boolean',
      default: false,
      description: 'only extract ids and print to the console'
    }
  },

  handler: (opts: HandlerOptions) => {
    const {namespace, apiUrl, batchSize, filename, dryRun} = opts
    const idSelector = parseSelector(opts.idSelector)
    const contentSelector = (opts.contentSelector != null) ? parseSelector(opts.contentSelector) : null
    const contentFilters = parseFilters(opts.contentFilters)
    const idRegex = (opts.idRegex != null) ? compileIdRegex(opts.idRegex) : null
    const streamName = 'standard input'

    const client = new RestClient({apiUrl})

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
          obj = objectPath.get(obj, contentSelector)
        }

        for (let filter of contentFilters) {
          objectPath.del(obj, filter)
        }

        let id = objectPath.get(obj, idSelector)
        if (idRegex != null) {
          id = extractId(id, idRegex)
        }

        if (id == null || id.length < 1) {
          throw new Error(
            `Unable to extract id using idSelector ${JSON.stringify(idSelector)}. Input record: \n` +
            JSON.stringify(obj, null, 2)
          )
        }
        const refs = [id]
        const tags = [] // TODO: support extracting tags

        if (dryRun) {
          console.log(`refs: ${JSON.stringify(refs)}, tags: ${JSON.stringify(tags)}`)
          return
        }

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
        if (statementBodies.length > 0) {
          publishPromises.push(
            publishBatch(client, namespace, statementBodies, statements)
          )
        }

        Promise.all(publishPromises)
          .then(() => {
            if (!dryRun) {
              console.log('All statements published successfully')
            }
          })
      })
  },

  extractId
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

function parseSelector (selector: string | Array<string>): Array<string> {
  if (Array.isArray(selector)) return selector.map(k => k.toString())

  selector = selector.trim()
  if (selector.startsWith('[')) {
    return parseSelector(JSON.parse(selector))
  }
  return selector.split('.')
}

function parseFilters (filterString: ?string): Array<Array<string>> {
  if (filterString == null) return []
  filterString = filterString.trim()
  if (filterString.startsWith('[')) {
    return JSON.parse(filterString).map(f => parseSelector(f))
  }

  const filters = filterString.split(',')
  return filters.map(s => parseSelector(s))
}

function compileIdRegex (idRegexStr: string): RegExp {
  if (!idRegexStr.startsWith('^')) idRegexStr = '^' + idRegexStr
  if (!idRegexStr.endsWith('$')) idRegexStr = idRegexStr + '$'
  return new RegExp(idRegexStr)
}

function extractId (fullId: string, idRegex: RegExp): string {
  const match = idRegex.exec(fullId)
  if (match == null) {
    throw new Error(`idRegex ${idRegex.toString()} failed to match on id string "${fullId}"`)
  }

  if (match.length === 1) {
    throw new Error(`idRegex must contain at least one capture group`)
  }

  let id = ''
  for (let i = 1; i < match.length; i++) {
    id += match[i]
  }
  return id
}
