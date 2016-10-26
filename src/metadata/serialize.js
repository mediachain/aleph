// @flow

// For now, this is just a very thin wrapper around the cbor lib.
// It exists so that we can swap out the implementation later without changing call sites

const cbor = require('cbor')
const {encode, decode} = cbor

module.exports = {
  encode,
  decode
}
