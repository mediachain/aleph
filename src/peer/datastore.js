// @flow

/**
 * @module aleph/peer/datastore
 */

const { clone } = require('lodash')
const Levelup = require('levelup')
const uuid = require('uuid')
const serialize = require('../metadata/serialize')
const { b58MultihashForBuffer } = require('../common/util')

export type DatastoreOptions = {
  backend: 'memory', // just in-memory for now, expand to e.g. rocksdb
  location?: string
}

const DefaultOptions: DatastoreOptions = {
  backend: 'memory'
}

/**
 * A content-addressed datastore used by {@link MediachainNode} to store data objects.
 * Objects are keyed by the base58-encoded multihash string of their content.
 * Plain JS objects may be stored, in which case they will be serialized to CBOR,
 * and the key will be the hash of the encoded object.
 *
 * Currently only supports in-memory storage.
 */
class Datastore {
  db: Levelup
  location: string

  constructor (options: ?DatastoreOptions = null) {
    if (options == null) {
      options = DefaultOptions
    } else {
      options = Object.assign(clone(DefaultOptions), options)
    }

    const levelOpts: Object = {}
    switch (options.backend) {
      case 'memory':
        levelOpts.db = require('memdown')
        break

      default:
        throw new Error(`Datastore backend ${options.backend} not supported`)
    }

    levelOpts.valueEncoding = valueCodec
    const location = options.location || '/aleph/data-' + uuid.v4()

    this.db = Levelup(location, levelOpts)
    this.location = location
  }

  /**
   * Add a `Buffer` of binary data or a JS object that can be encoded to CBOR.
   * @param value
   * @returns {Promise<string>}
   *  resolves to a base58-encoded multihash string, which encodes the sha256 hash
   *  of the object's content.  If `value` is a JS object, it will be serialized to
   *  CBOR before being hashed and stored.
   */
  put (value: Buffer | Object): Promise<string> {
    return Promise.resolve().then(() => {
      if (!Buffer.isBuffer(value)) {
        value = serialize.encode(value)
      }

      const key = b58MultihashForBuffer(value)

      return new Promise((resolve, reject) => {
        this.db.put(key, value, { sync: true }, (err) => {
          if (err) return reject(err)
          resolve(key)
        })
      })
    })
  }

  /**
   * Fetches an object by its `key`, returning either the raw `Buffer` for the key, or
   * a deserialized JS object.
   * @param key
   * @param opts
   *  If `opts.returnRawBuffer` is `true`, will not attempt to deserialize data objects from CBOR.
   * @returns {Promise<Object | Buffer>}
   *  If `opts.returnRawBuffer` is `true`, or if a given value can't be deserialized, resolves to
   *  the raw `Buffer` associated with the given key.
   *  If `opts.returnRawBuffer` is `false` or not present, will attempt to deserialize objects from CBOR.
   *  If deserialization fails, resolves to the raw buffer.
   *
   *  Will fail with an Error if no object exists for the given key, or if a low-level error occurs.
   *  "object not found" errors will have a `.notFound` property, which can be used to distinguish them
   *  from low-level errors.
   */
  get (key: string, opts: {returnRawBuffer?: boolean} = {}): Promise<Object | Buffer> {
    return new Promise((resolve, reject) => {
      this.db.get(key, (err, val) => {
        if (err) return reject(err)

        if (opts.returnRawBuffer === true) {
          return resolve(val)
        }

        try {
          return resolve(serialize.decode(val))
        } catch (err) {
          return resolve(val)
        }
      })
    })
  }

  /**
   * Check if the datastore has an object for the given key.
   * @param key
   * @returns {Promise<boolean>}
   *  Resolves to true if the object exists, false otherwise.
   *  Fails with an `Error` if a low-level failure occurs.
   */
  has (key: string): Promise<boolean> {
    return this.get(key, {returnRawBuffer: true})
      .then(() => true)
      .catch(err => {
        if (err.notFound) return false
        throw err
      })
  }
}

const valueCodec = {
  type: 'noop',
  buffer: true,

  encode (val: Buffer): Buffer {
    return val
  },

  decode (buf: Buffer): Buffer {
    return buf
  }
}

module.exports = {
  Datastore
}
