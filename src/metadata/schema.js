// @flow

/**
 * @module aleph/metadata/schema
 * @description Tools for manipulating and validating "self-describing" schemas.
 */

const fs = require('fs')
const Ajv = require('ajv')
const ajv = new Ajv({allErrors: true})

// add the snowplow self-describing schema definition, so schema-guru generated schemas will resolve correctly
ajv.addMetaSchema(
  require('./schemas/com.snowplowanalytics.self-desc-jsonschema-1-0-0.json'),
  'http://iglucentral.com/schemas/com.snowplowanalytics.self-desc/schema/jsonschema/1-0-0#'
)

const SchemaVer = require('./schemaver')

const SCHEMA_WKI_PREFIX = 'schema:'

/**
 * @typedef SelfDescribingRecord
 * @description
 *  A wrapper object that contains a `data` payload object, and a
 *  `SchemaReference` which identifies a schema that can validate the `data`.
 * @property {SchemaReference} schema
 *  An IPLD link object that links to a self-describing schema object.
 * @property {Object} data
 *  Any JS object that fits the linked schema
 */
export type SelfDescribingRecord = {
  schema: SchemaReference,
  data: Object
}

/**
 * @typedef SchemaDescription
 * @description
 *  human-readable identifiers for a schema, including semantic version
 *  this will be contained in the schema itself (under the `self` field)
 * @property {string} vendor
 *  A string that identifies the creator of the schema, e.g. `'io.mediachain'` or `'org.moma'`
 * @property {string} name
 *  A name that indicates what kind of object the schema is for. e.g. `'image'` or `'blogPost'`.
 *  Should be unique per-vendor.
 * @property {string} version
 *  A SchemaVer version string.
 * @property {string} format
 *  Currently only `'jsonschema'` is supported.
 *
 */
export type SchemaDescription = {
  vendor: string,
  name: string,
  version: string,
  format: string,
}

/**
 * @typedef SchemaReference
 * @description An IPLD link object, whose string value is the b58-encoded multihash of a schema
 * @property {string} /
 *  The base58-encoded multihash of a CBOR-encoded schema object.
 */
export type SchemaReference = {'/': string}

/**
 * @typedef SelfDescribingSchema
 * @description A valid JSONSchema that includes a `self` field with identifying information.
 * @property {SchemaDescription} self
 *  Identifies the schema by vendor, name, version and format.
 */
export type SelfDescribingSchema = {
  self: SchemaDescription
}

function isObject (o: ?mixed): boolean {
  return (o != null && typeof (o) === 'object')
}

/**
 * Check if the given object is a valid {@link SchemaDescription}
 * @param obj
 * @returns {boolean}
 */
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

/**
 * Check if the given object is a valid IPLD link.
 * @param {Object} obj
 * @returns {boolean}
 */
function isSchemaReference (obj: Object): boolean {
  return isObject(obj) && typeof obj['/'] === 'string'
}

/**
 * Check if the given object is a valid {@link SelfDescribingRecord}
 * @param {Object} obj
 * @returns {boolean}
 */
function isSelfDescribingRecord (obj: Object): boolean {
  if (!isObject(obj)) return false
  if (!isObject(obj.schema)) return false
  if (!isObject(obj.data)) return false

  return isSchemaReference(obj.schema)
}

/**
 * Check whether the two given {@link SchemaDescription}s are the same (ignoring version)
 * @param {SchemaDescription} a
 * @param {SchemaDescription} b
 * @returns {boolean}
 */
function schemaDescriptionIsSameSchema (a: SchemaDescription, b: SchemaDescription): boolean {
  return a.name === b.name && a.vendor === b.vendor && a.format === b.format
}

/**
 * Check whether the two given {@link SchemaDescription}s are identical (including version)
 * @param {SchemaDescription} a
 * @param {SchemaDescription} b
 * @returns {boolean}
 */
function schemaDescriptionIsEqual (a: SchemaDescription, b: SchemaDescription): boolean {
  return schemaDescriptionIsSameSchema(a, b) &&
    a.version === b.version
}

/**
 * Check whether the two given {@link SchemaDescription}s can be considered compatible.
 * @param a
 * @param b
 * @returns {boolean}
 */
function schemaDescriptionIsCompatible (a: SchemaDescription, b: SchemaDescription): boolean {
  return schemaDescriptionIsSameSchema(a, b) &&
    SchemaVer.isCompatible(a.version, b.version)
}

/**
 * Returns a URI-like string for a given {@link SchemaDescription}
 * @param {SchemaDescription} desc
 * @returns {string}
 */
function schemaDescriptionToWKI (desc: SchemaDescription): string {
  const { vendor, name, format, version } = desc
  return SCHEMA_WKI_PREFIX + [vendor, name, format, version].join('/')
}

/**
 * @typedef ValidationResult
 * @description Returned by {@link metadata/schema.validate}
 * @property {boolean} success
 *  True if validation succeeds, false for validation failure
 * @property {?Error}
 *  If validation fails, will contain an Error object. Undefined on success.
 */
export type ValidationResult = {success: true} | {success: false, error: Error}

/**
 * Validate the given `payload` object using the provided `schema`
 * @param {SelfDescribingSchema} schema
 * @param {SelfDescribingRecord | Object} payload
 * @returns {ValidationResult}
 */
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

/**
 * Load a self-describing schema from a file, validating it before returning
 * @param filename
 * @returns {SelfDescribingSchema}
 */
function loadSelfDescribingSchema (filename: string): SelfDescribingSchema {
  const obj = JSON.parse(fs.readFileSync(filename, 'utf-8'))
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
