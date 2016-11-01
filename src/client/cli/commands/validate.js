// @flow

const fs = require('fs')
const RestClient = require('../../api/RestClient')
const { JQTransform } = require('../../../metadata/jqStream')
const { validate, loadSelfDescribingSchema, validateSelfDescribingSchema } = require('../../../metadata/schema')
const { pluralizeCount, isB58Multihash } = require('../util')
import type { Readable } from 'stream'
import type { SelfDescribingSchema } from '../../../metadata/schema'

type HandlerOptions = {
  apiUrl: string,
  schema: string,
  filename?: string,
  jqFilter: string,
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
        'If you use this, idSelector should be relative to the filtered output.\n',
      default: '.'
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
  jqFilter: string
}) {
  const {
    stream,
    streamName,
    schema,
    jqFilter
  } = opts

  let count = 0

  const jq = new JQTransform(jqFilter)

  stream.pipe(jq)
    .on('data', jsonString => {
      const obj = JSON.parse(jsonString)
      const result = validate(schema, obj)
      if (!result.success) {
        throw new Error(`${result.error.message}.\nFailed object:\n${jsonString}`)
      }
      count += 1
    })
    .on('error', err => {
      console.error(`Error reading from ${streamName}: `, err)
      process.exit(1)
    })
    .on('end', () => {
      console.log(`${pluralizeCount(count, 'statement')} validated successfully`)
    })
}

