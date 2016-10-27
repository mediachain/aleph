// @flow

const fs = require('fs')
const ndjson = require('ndjson')
const objectPath = require('object-path')
const RestClient = require('../../api/RestClient')
const { validate, loadSelfDescribingSchema, validateSelfDescribingSchema } = require('../../../metadata/schema')
const { pluralizeCount, isB58Multihash } = require('../util')
import type { Readable } from 'stream'
import type { SelfDescribingSchema } from '../../../metadata/schema'

type HandlerOptions = {
  apiUrl: string,
  schema: string,
  filename: ?string,
  idSelector: string,
  contentSelector: ?string,
  idRegex: ?string,
  contentFilters: ?string
}

module.exports = {
  command: 'validate <schema> [filename]',
  description: 'validate newline-delimited json statements against the given schema. ' +
    '`schema` can be either a path to a local schema, or the base58 object id of a published schema. ' +
  'statements will be read from `filename` or stdin.\n',
  builder: {
    contentSelector: {
      description: 'If present, use as a keypath to select a subset of the data to publish. ' +
      'If contentSelector is used, idSelector should be relative to it, not to the content root.\n'
    },
    contentFilters: {
      description: 'Key-paths to omit from content. Multiple keypaths can be joined with ",". \n'
    }
  },

  handler: (opts: HandlerOptions) => {
    const { apiUrl, schema, filename } = opts
    const contentSelector = (opts.contentSelector != null) ? parseSelector(opts.contentSelector) : null
    const contentFilters = parseFilters(opts.contentFilters)
    let streamName = 'standard input'

    let stream: Readable
    if (filename) {
      stream = fs.createReadStream(filename)
      streamName = filename
    } else {
      stream = process.stdin
    }

    let schemaPromise: Promise<SelfDescribingSchema>
    if (isB58Multihash(schema)) {
      const client = new RestClient({apiUrl})
      schemaPromise = client.getData(schema).then(validateSelfDescribingSchema)
    } else {
      schemaPromise = Promise.resolve(loadSelfDescribingSchema(schema))
    }

    schemaPromise.then(schema => {
      validateStream({
        stream,
        streamName,
        schema,
        contentSelector,
        contentFilters
      })
    })
  }
}

function validateStream (opts: {
  stream: Readable,
  streamName: string,
  schema: SelfDescribingSchema,
  contentSelector: ?Array<string>,
  contentFilters: Array<Array<string>>
}) {
  const {
    stream,
    streamName,
    schema,
    contentSelector,
    contentFilters
  } = opts

  let count = 0

  stream.pipe(ndjson.parse())
    .on('data', obj => {
      if (contentSelector != null) {
        obj = objectPath.get(obj, contentSelector)
      }

      for (let filter of contentFilters) {
        objectPath.del(obj, filter)
      }

      const result = validate(schema, obj)
      if (!result.success) {
        throw new Error(`${result.error.message}.\nFailed object:\n${JSON.stringify(obj, null, 2)}`)
      }
      count += 1
    })
    .on('error', err => console.error(`Error reading from ${streamName}: `, err))
    .on('end', () => {
      console.log(`${pluralizeCount(count, 'statement')} validated successfully`)
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
