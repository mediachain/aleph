// @flow

const fs = require('fs')
const path = require('path')
const RestClient = require('../../api/RestClient')
const { JQTransform } = require('../../../metadata/jqStream')
const { validate, loadSelfDescribingSchema, validateSelfDescribingSchema } = require('../../../metadata/schema')
const { subcommand, pluralizeCount, isB58Multihash } = require('../util')
import type { Readable } from 'stream'
import type { SelfDescribingSchema } from '../../../metadata/schema'

type HandlerOptions = {
  client: RestClient,
  schema?: string,
  jsonld: boolean,
  filename?: string,
  jqFilter: string,
}

module.exports = {
  command: 'validate [filename]',
  description: 'Validate newline-delimited json objects against a schema. ' +
  'Objects will be read from `filename` or stdin.\n',
  builder: {
    schema: {
      description: 'Either a path to a local schema, or the base58 object id of a published schema. ' +
        'Required, unless --jsonld is present.\n',
      type: 'string'
    },
    jsonld: {
      description: 'If --jsonld is present, validate that inputs are structurally valid JSONLD.  ' +
        'This does not ensure that they are semantically correct.\n',
      type: 'boolean',
      default: false,
      defaultDescription: 'False.  Setting this flag will cause the --schema argument to be ignored.'
    },
    jqFilter: {
      type: 'string',
      description: 'A jq filter to apply to input records as a pre-processing step. ' +
        'The filtered output will be validated against the schema. ' +
        'If you use this, idSelector should be relative to the filtered output.\n',
      default: '.'
    }
  },

  handler: subcommand((opts: HandlerOptions) => {
    const { client, filename, jqFilter, jsonld } = opts
    let { schema } = opts
    let streamName = 'standard input'

    let stream: Readable
    if (filename) {
      stream = fs.createReadStream(filename)
      streamName = filename
    } else {
      stream = process.stdin
    }

    if (jsonld === true) {
      schema = path.join(__dirname, '..', '..', '..', 'metadata', 'schemas',
        'io.mediachain.jsonld-jsonschema-1-0-0.json')
    }

    if (schema == null) {
      console.error('You must provide either the --schema or --jsonld arguments.')
      process.exit(1)
      return  // flow doesn't seem to recognize process.exit
    }

    let schemaPromise: Promise<SelfDescribingSchema>
    if (isB58Multihash(schema)) {
      schemaPromise = client.getData(schema).then(validateSelfDescribingSchema)
    } else {
      schemaPromise = Promise.resolve(loadSelfDescribingSchema(schema))
    }

    schemaPromise.then(schema =>
      validateStream({
        stream,
        streamName,
        schema,
        jqFilter
      })
    )
  })
}

function validateStream (opts: {
  stream: Readable,
  streamName: string,
  schema: SelfDescribingSchema,
  jqFilter: string
}): Promise<*> {
  const {
    stream,
    streamName,
    schema,
    jqFilter
  } = opts

  let count = 0

  const jq = new JQTransform(jqFilter)

  return new Promise(resolve => {
    stream.pipe(jq)
      .on('data', jsonString => {
        const obj = JSON.parse(jsonString)
        const result = validate(schema, obj)
        if (!result.success) {
          console.error(`${result.error.message}.\nFailed object:\n${jsonString}`)
          process.exit(1)
        }
        count += 1
      })
      .on('error', err => {
        console.error(`Error reading from ${streamName}: `, err.message)
        process.exit(1)
      })
      .on('end', () => {
        console.log(`${pluralizeCount(count, 'statement')} validated successfully`)
        resolve()
      })
  })
}

