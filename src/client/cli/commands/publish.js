// @flow

const fs = require('fs')
const { JQTransform } = require('../../../metadata/jqStream')
const objectPath = require('object-path')
const RestClient = require('../../api/RestClient')
const { println, subcommand } = require('../util')
const { validate, validateSelfDescribingSchema, isSelfDescribingRecord } = require('../../../metadata/schema')
import type { Readable } from 'stream'
import type { SelfDescribingSchema } from '../../../metadata/schema'

const BATCH_SIZE = 1000

type HandlerOptions = {
  namespace: string,
  schemaReference?: string,
  client: RestClient,
  jqFilter: string,
  idFilter: string,
  filename?: string,
  batchSize: number,
  compound?: number,
  dryRun: boolean,
  skipSchemaValidation: boolean
}

module.exports = {
  command: 'publish [filename]',
  description: 'Publish a batch of statements from a batch of newline-delimited json. ' +
    'Statements will be read from `filename` or stdin.\n',
  builder: {
    batchSize: { default: BATCH_SIZE },
    namespace: {
      required: true,
      type: 'string',
      description: 'The mediachain namespace to publish statements to.\n'
    },
    idFilter: {
      required: true,
      type: 'string',
      description: 'A jq filter that produces a mediachain identifier from your input object.  ' +
      'Will be applied after `jqFilter`, and does not modify the object itself.\n'
    },
    jqFilter: {
      type: 'string',
      description: 'A jq filter string to use to pre-process your input data.\n',
      default: '.'
    },
    dryRun: {
      type: 'boolean',
      default: false,
      description: 'Only extract ids and print to the console.\n'
    },
    schemaReference: {
      description: 'A multihash reference to a schema object used to validate objects before publishing. ' +
        'Including a schema reference will result in "self-describing" objects that link to their schema. ' +
        'The schema object must exist on the local node before running the publish command.\n',
      type: 'string'
    },
    skipSchemaValidation: {
      type: 'boolean',
      default: false,
      description: "Don't validate records against referenced schema before publishing.  Use only if you've " +
        'pre-validated your records! \n'
    },
    compound: {
      type: 'int',
      required: false,
      description: 'If present, publish compound statements of `compound` number of records. \n'
    }
  },

  handler: subcommand((opts: HandlerOptions) => {
    const {client, namespace, schemaReference, batchSize, filename, dryRun, skipSchemaValidation, jqFilter, idFilter, compound} = opts
    const publishOpts = {namespace, compound}

    let stream: Readable
    let streamName = 'standard input'
    if (filename) {
      stream = fs.createReadStream(filename)
      streamName = filename
    } else {
      stream = process.stdin
    }

    let schemaPromise: Promise<?SelfDescribingSchema>
    if (schemaReference == null || skipSchemaValidation) {
      schemaPromise = Promise.resolve(null)
    } else {
      schemaPromise = client.getData(schemaReference)
        .catch(err => {
          throw new Error(`Failed to retrieve schema with object id ${schemaReference}: ${err.message}`)
        })
        .then((schema) => {
          try {
            return validateSelfDescribingSchema(schema)
          } catch (err) {
            throw new Error(
              `Schema with object id ${schemaReference} is not a valid self-describing schema: ${err.message}`
            )
          }
        })
    }

    return schemaPromise
      .then(schema =>
        publishStream({
          stream,
          streamName,
          client,
          batchSize,
          dryRun,
          skipSchemaValidation,
          publishOpts,
          schemaReference,
          schema,
          jqFilter: composeJQFilters(jqFilter, idFilter)})
      )
  })
}

function publishStream (opts: {
  stream: Readable,
  streamName: string,
  client: RestClient,
  batchSize: number,
  dryRun: boolean,
  skipSchemaValidation: boolean,
  publishOpts: {namespace: string, compound?: number},
  schemaReference?: string,
  schema: ?SelfDescribingSchema,
  jqFilter: string
}): Promise<*> {
  const {
    stream,
    streamName,
    client,
    publishOpts,
    batchSize,
    dryRun,
    skipSchemaValidation,
    schemaReference,
    schema,
    jqFilter
  } = opts

  let statementBodies: Array<Object> = []
  let statements: Array<Object> = []
  const jq = new JQTransform(jqFilter)
  let wki: string
  let obj: Object

  // We want to know when all of our batches have been published,
  // so we can complete the subcommand handler and exit the process.
  // Rather than use Promise.all(), which requires us to keep
  // (potentially) thousands of Promise objects around, we add
  // Promises for in-flight batches to this map, keyed by a
  // unique id.  Then we remove them when the batch completes.
  const pendingBatches: Map<string, Promise<void>> = new Map()
  let batchCounter = 0
  function addBatchPromise (batchPromise: Promise<void>) {
    const batchId = 'batch-' + batchCounter.toString()
    batchCounter++
    pendingBatches.set(batchId, batchPromise
      .then(() => {
        pendingBatches.delete(batchId)
      })
    )
  }

  // Called when the input stream completes, after all batch
  // promises have been added.  Will resolve when all pending
  // batch promises have resolved
  function waitForCompletion (): Promise<void> {
    return new Promise((resolve) => {
      function check () {
        if (pendingBatches.size === 0) return resolve()
        setTimeout(check, 100)
      }

      check()
    })
  }

  return new Promise((resolve, reject) => {
    // cleanup before rejecting the promise on failure
    function publishFailed (err: Error) {
      stream.unpipe()
      jq.kill()
      reject(err)
    }

    stream.pipe(jq)
      .on('data', jsonString => {
        try {
          const parsed = JSON.parse(jsonString)
          wki = parsed.wki
          obj = parsed.obj
        } catch (err) {
          return publishFailed(new Error(`Error parsing jq output: ${err}\njq output: ${jsonString}`))
        }

        if (schema != null && !skipSchemaValidation) {
          const result = validate(schema, obj)
          if (!result.success) {
            return publishFailed(new Error(`Record failed validation: ${result.error.message}. Failed object: ${JSON.stringify(obj, null, 2)}`))
          }
        }

        if (wki == null || wki.length < 1) {
          throw new Error(
            `Unable to extract id. Input record: \n` +
            JSON.stringify(obj, null, 2)
          )
        }

        wki = wki.toString()

        const refs = [ wki ]
        const tags = [] // TODO: support extracting tags
        const deps = []

        if (schemaReference != null) {
          deps.push(schemaReference)

          if (isSelfDescribingRecord(obj)) {
            const ref = objectPath.get(obj, 'schema', '/')
            if (ref !== schemaReference) {
              return publishFailed(new Error(
                `Record contains reference to a different schema (${ref}) than the one specified ${schemaReference}`
              ))
            }
          } else {
            obj = {
              schema: { '/': schemaReference },
              data: obj
            }
          }
        }

        if (dryRun) {
          println(`refs: ${JSON.stringify(refs)}, tags: ${JSON.stringify(tags)}, deps: ${JSON.stringify(deps)}`)
          return
        }

        const stmt = { object: obj, refs, tags, deps }

        statementBodies.push(obj)
        statements.push(stmt)

        if (statementBodies.length >= batchSize) {
          addBatchPromise(
            publishBatch(client, publishOpts, statementBodies, statements)
              .catch(publishFailed)
          )
          statementBodies = []
          statements = []
        }
      })
      .on('end', () => {
        if (statementBodies.length > 0) {
          addBatchPromise(
            publishBatch(client, publishOpts, statementBodies, statements)
              .catch(publishFailed)
          )
        }
        waitForCompletion()
          .then(() => {
            if (!dryRun) {
              println('All statements published successfully')
            }
            resolve()
          })
      })
      .on('error', err => {
        publishFailed(new Error(`Error reading from ${streamName}: ${err.message}`))
      })
  })
}

function publishBatch (client: RestClient,
                       publishOpts: {namespace: string, compound?: number},
                       statementBodies: Array<Object>,
                       statements: Array<Object>): Promise<*> {
  return client.putData(...statementBodies)
    .then(bodyHashes => {
      if (bodyHashes.length !== statements.length) {
        throw new Error(`Expected ${statements.length} results from putting data blobs, received ${bodyHashes.length}`)
      }
      statements = statements.map((s, i) => {
        s.object = bodyHashes[i]
        return s
      })

      return client.publish(publishOpts, ...statements)
        .then(statementIds => [bodyHashes, statementIds])
    })
    .then(([bodyHashes, statementIds]) => {
      printBatchResults(bodyHashes, statementIds, statements, publishOpts.compound || 1)
    })
}

function composeJQFilters (contentFilter: string, idFilter: string): string {
  return `${contentFilter} as $output | {wki: ($output | ${idFilter}), obj: $output}`
}

function printBatchResults (bodyHashes: Array<string>, statementIds: Array<string>, statements: Array<Object>,
                            compoundSize: number) {
  for (let i = 0; i < statementIds.length; i++) {
    println(`\nstatement id: ${statementIds[i]}`)
    const statementInfos = []

    for (let j = i; j < i + compoundSize; j++) {
      const object = bodyHashes[j]
      const {refs, tags, deps} = statements[j]
      statementInfos.push({object, refs, tags, deps})
    }

    println(JSON.stringify(statementInfos, null, 2))
  }
}

