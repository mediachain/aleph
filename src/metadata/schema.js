// @flow

const fs = require('fs')
const Ajv = require('ajv')
const ajv = new Ajv({allErrors: true})
const SchemaVer = require('./schemaver')

const SCHEMA_WKI_PREFIX = 'schema:'

// a "self-describing" record contains a `data` payload, and a reference to a schema
export type SelfDescribingRecord = {
  schema: SchemaReference,
  data: Object
}

// human-readable identifiers for a schema, including semantic version
// this will be contained in the schema itself (under the `self` field)
export type SchemaDescription = {
  vendor: string,
  name: string,
  version: string,
  format: string,
}

// A SchemaReference is an IPLD-style link object, whose string value is the b58-encoded multihash of a schema
export type SchemaReference = {'/': string}

/**
 * The fields we require a self-describing schema to have.
 */
export type SelfDescribingSchema = {
  self: SchemaDescription
}

function isObject (o: ?mixed): boolean {
  return (o != null && typeof (o) === 'object')
}

function isSchemaDescription (obj: Object): boolean {
  if (!isObject(obj)) return false
  if (typeof (obj.vendor) !== 'string' ||
    typeof (obj.name) !== 'string' ||
    typeof (obj.version) !== 'string' ||
    typeof (obj.format) !== 'string') {
    return false
  }

  if (SchemaVer.parseSchemaVer(obj.version) == null) {
    return false
  }
  return true
}

function isSchemaReference (obj: Object): boolean {
  return isObject(obj) && typeof obj['/'] === 'string'
}

function isSelfDescribingRecord (obj: Object): boolean {
  if (!isObject(obj)) return false
  if (!isObject(obj.schema)) return false
  if (!isObject(obj.data)) return false

  return isSchemaReference(obj.schema)
}

function schemaDescriptionIsSameSchema (a: SchemaDescription, b: SchemaDescription): boolean {
  return a.name === b.name && a.vendor === b.vendor && a.format === b.format
}

function schemaDescriptionIsEqual (a: SchemaDescription, b: SchemaDescription): boolean {
  return schemaDescriptionIsSameSchema(a, b) &&
    a.version === b.version
}

function schemaDescriptionIsCompatible (a: SchemaDescription, b: SchemaDescription): boolean {
  return schemaDescriptionIsSameSchema(a, b) &&
    SchemaVer.isCompatible(a.version, b.version)
}

function schemaDescriptionToWKI (desc: SchemaDescription): string {
  const { vendor, name, format, version } = desc
  return SCHEMA_WKI_PREFIX + [vendor, name, format, version].join('/')
}

export type ValidationResult = {success: true} | {success: false, error: Error}

function validate (schema: SelfDescribingSchema, payload: Object): ValidationResult {
  let data = payload
  if (isSelfDescribingRecord(payload)) {
    data = (payload.data: Object)
  }

  if (schema.self.format !== 'jsonschema') {
    return {
      success: false,
      error: new Error('schema validation is only supported where schema format === "jsonschema"')
    }
  }

  if (ajv.validate(schema, data)) {
    return {success: true}
  }

  const errorInfo = formatAjvErrors(ajv.errors)
  return {
    success: false,
    error: new Error(`Schema validation failed: \n${errorInfo}`)
  }
}

type AjvError = {
  keyword: string,
  dataPath: string,
  schemaPath: string,
  params: {[id:string]: string},
  message: string
}
function formatAjvErrors (errors: Array<AjvError>): string {
  const lines = []
  for (const err of errors) {
    let msg = `root_object${err.dataPath} ${err.message}`
    if (err.params != null && Object.keys(err.params).length > 0) {
      msg += ': ' + JSON.stringify(err.params)
    }
    lines.push(msg)
  }
  return lines.join('\n')
}

/**
 * Validate that the given `schemaObject` is in fact a valid json-schema, with a SchemaDescription.
 * @param schemaObject - a self-describing json schema object
 * @returns the original object, with a flow typecast for fuzzy good feelings
 * @throws if schemaObject is not a valid json-schema, or if it lacks required self-description properties
 */
function validateSelfDescribingSchema (schemaObject: Object): SelfDescribingSchema {
  if (!isObject(schemaObject)) {
    throw new Error('Self-describing schema must be an object, but you gave me ' + typeof schemaObject)
  }

  if (schemaObject.self == null || !isSchemaDescription(schemaObject.self)) {
    throw new Error('Self-describing schema must have a "self" field with "vendor", "name", "version" and "format"')
  }

  if (!ajv.validateSchema(schemaObject)) {
    throw new Error(`Self-describing schema object is not a valid json-schema: ${ajv.errorsText()}`)
  }

  return (schemaObject: SelfDescribingSchema) // promote the flow type, now that we know it's valid
}

function loadSelfDescribingSchema (filename: string): SelfDescribingSchema {
  const obj = JSON.parse(fs.readFileSync(filename, 'utf-8'))
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error(`Schema file "${filename}" must contain a single json object that defines a json schema.`)
  }

  return validateSelfDescribingSchema(obj)
}

module.exports = {
  validate,
  validateSelfDescribingSchema,
  loadSelfDescribingSchema,
  schemaDescriptionToWKI,
  isSelfDescribingRecord,
  isSchemaDescription,
  isSchemaReference,
  schemaDescriptionIsSameSchema,
  schemaDescriptionIsEqual,
  schemaDescriptionIsCompatible
}
