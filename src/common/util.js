// @flow

const Multihashing = require('multihashing')

/**
 * ES6+ implementation of rsvp's Promise.hash method:
 * https://github.com/tildeio/rsvp.js/#hash-of-promises
 * @param hash
 * @constructor
 */
function PromiseHash (hash: Object): Promise<Object> {
  // get the key values pairs in a consistent ordering for iteration
  const keys = Object.keys(hash)
  const vals = keys.map(k => hash[k])
  return Promise.all(vals).then(resolved => {
    const result: Object = {}
    resolved.forEach((r, idx) => {
      const key = keys[idx]
      result[key] = r
    })
    return result
  })
}

function MultihashB58ForBuffer (buf: Buffer): string {
  return Multihashing.multihash.toB58String(
    Multihashing(buf, 'sha2-256')
  )
}

module.exports = {
  PromiseHash,
  MultihashB58ForBuffer
}
