// @flow

const RestClient = require('../../api/RestClient')
const { subcommand, println } = require('../util')
const { loadSelfDescribingSchema, schemaDescriptionToWKI } = require('../../../metadata/schema')

const SCHEMA_NAMESPACE = 'mediachain.schemas'

module.exports = {
  command: 'publishSchema <filename>',
  description: 'Publish a self-describing json-schema document to the local node.\n',
  builder: {
    namespace: {
      description: 'Namespace to publish the schema to.',
      type: 'string',
      default: SCHEMA_NAMESPACE
    }
  },

  handler: subcommand((opts: {client: RestClient, schemaName: string, version: string, filename: string, namespace: string}) => {
    const {client, filename, namespace} = opts

    const schema = loadSelfDescribingSchema(filename)
    const wki = schemaDescriptionToWKI(schema.self)

    return client.putData(schema)
      .then(([objectId]) =>
        client.publish({namespace}, {object: objectId, refs: [wki]})
          .then(([statementId]) => {
            println(`Published schema with wki = ${wki} to namespace ${namespace}`)
            println(`Object ID: ${objectId}`)
            println(`Statement ID: ${statementId}`)
          }))
  })
}
