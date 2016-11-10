// @flow

const cbor = require('cbor')
const NoFilter = require('nofilter')
const {Encoder, decode} = cbor

// the default encoder fails if given input > 16KB.  Up this to 1MB to support big objects
const MAX_INPUT_SIZE = 1024 * 1024

// The default cbor Encoder.encode function, with the the stream highWaterMark overridden
function encode () {
  const objs = Array.prototype.slice.apply(arguments)
  const enc = new Encoder({highWaterMark: MAX_INPUT_SIZE})
  const bs = new NoFilter()
  enc.pipe(bs)
  for (const o of objs) {
    if (typeof o === 'undefined') {
      enc._pushUndefined()
    } else if (o === null) {
      enc._pushObject(null)
    } else {
      enc.write(o)
    }
  }
  enc.end()
  return bs.read()
}

module.exports = {
  encode,
  decode
}
