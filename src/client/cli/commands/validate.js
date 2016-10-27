// @flow

const fs = require('fs')
const ndjson = require('ndjson')
const { run: runJQ } = require('node-jq')
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
  jqFilter: ?string,
}

module.exports = {
  command: 'validate <schema> [filename]',
  description: 'validate newline-delimited json statements against the given schema. ' +
    '`schema` can be either a path to a local schema, or the base58 object id of a published schema. ' +
  'statements will be read from `filename` or stdin.\n',
  builder: {
    jqFilter: {
      type: 'string',
      description: 'A jq filter to apply to input records as a pre-processing step. ' +
        'The filtered output will be validated against the schema. ' +
        'If you use this, idSelector should be relative to the filtered output.\n'
    }
  },

  handler: (opts: HandlerOptions) => {
    const { apiUrl, schema, filename, jqFilter } = opts
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
        jqFilter
      })
    })
  }
}

function validateStream (opts: {
  stream: Readable,
  streamName: string,
  schema: SelfDescribingSchema,
  jqFilter: ?string
}) {
  const {
    stream,
    streamName,
    schema,
    jqFilter
  } = opts

  let count = 0
  let promises = []

  stream.pipe(ndjson.parse())
    .on('data', obj => {
      const p = transformObject(obj, jqFilter).then(obj => {
        const result = validate(schema, obj)
        if (!result.success) {
          throw new Error(`${result.error.message}.\nFailed object:\n${JSON.stringify(obj, null, 2)}`)
        }
        count += 1
      })
      promises.push(p)
    })
    .on('error', err => console.error(`Error reading from ${streamName}: `, err))
    .on('end', () => {
      Promise.all(promises).then(() => {
        console.log(`${pluralizeCount(count, 'statement')} validated successfully`)
      })
    })
}

function transformObject (obj: Object, jqFilter: ?string): Promise<Object> {
  if (jqFilter == null) {
    return Promise.resolve(obj)
  }

  return runJQ(jqFilter, obj, {input: 'json', output: 'json'})
    .catch(err => {
      console.error('jq error: ', err)
    })
}
