// @flow

const cbor = require('borc')
const {encode, decodeFirst} = cbor

module.exports = {
  encode,
  decode: decodeFirst
}
