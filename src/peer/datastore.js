// @flow

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

  put (value: Buffer | Object): Promise<string> {
    if (!Buffer.isBuffer(value)) {
      value = serialize.encode(value)
    }

    const key = b58MultihashForBuffer(value)

    return new Promise((resolve, reject) => {
      this.db.put(key, value, {sync: true}, (err) => {
        if (err) return reject(err)
        resolve(key)
      })
    })
  }

  get (key: string, opts: {returnRawBuffer?: boolean} = {}): Promise<Object | string> {
    return new Promise((resolve, reject) => {
      this.db.get(key, (err, val) => {
        if (err) return reject(err)

        if (opts.returnRawBuffer === true) {
          return resolve(val)
        }

        try {
          return resolve(serialize.decode(val))
        } catch (err) {
          return resolve(val.toString('base64'))
        }
      })
    })
  }

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
