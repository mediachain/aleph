// @flow

const RestClient = require('../../api/RestClient')
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

  handler: (opts: {apiUrl: string, schemaName: string, version: string, filename: string, namespace: string}) => {
    const {apiUrl, filename, namespace} = opts
    const client = new RestClient({apiUrl})

    const schema = loadSelfDescribingSchema(filename)
    const wki = schemaDescriptionToWKI(schema.self)

    client.putData(schema)
      .then(([objectId]) =>
        client.publish({namespace}, {object: objectId, refs: [wki]})
          .then(([statementId]) => {
            console.log(`Published schema with wki = ${wki} to namespace ${namespace}`)
            console.log(`Object ID: ${objectId}`)
            console.log(`Statement ID: ${statementId}`)
          }))
      .catch(err => console.error(err.message))
  }
}
