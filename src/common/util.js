// @flow

/**
 * @module aleph/common/util
 * @description handy utility things that seem broadly useful
 */

const _ = require('lodash')
const Multihash = require('multihashes')
const crypto = require('crypto')

import type { Writable, Readable } from 'stream'
import type { WriteStream } from 'tty'

/**
 * ES6+ implementation of rsvp's Promise.hash method:
 * {@link https://github.com/tildeio/rsvp.js/#hash-of-promises}
 * @param {object} hash a JS object whose values may be `Promise`s
 * @returns {object} a JS object with the same keys as `hash`, whose values are
 *          the resolved values of that key's promise.  If any promise fails,
 *          the whole thing will fail.
 *
 * @example
 * promiseHash({
 *   posts: API.fetchPosts(userId), // returns Promise<Array<Post>>
 *   user: API.fetchUser(userId)    // returns Promise<User>
 * })
 *  .then(results => {
 *    const {
 *      posts, // resolved Array<Post>
 *      user   // resolved User
 *    } = results
 *    console.log(`User ${user.name} has ${posts.length} posts`)
 *  })
 */
function promiseHash (hash: Object): Promise<Object> {
  // get the key value pairs in a consistent ordering for iteration
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

/**
 * Reject `promise` if it doesn't complete within `timeout` milliseconds
 * @param {number} timeout milliseconds to wait before rejecting
 * @param {Promise.<*>} promise a promise that you want to set a timeout for
 * @returns a Promise that will resolve to the value of `promise`, unless the timeout is exceeded
 */
function promiseTimeout<T> (timeout: number, promise: Promise<T>): Promise<T> {
  return Promise.race([promise, new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error(`Timeout of ${timeout}ms exceeded`))
    }, timeout)
  })])
}

/**
 * Given an `array` of `T`s, apply function `f` of `T => Array<U>`,
 * to each element, returning a flattened array of `U`s
 * @param {Array.<*>} array
 * @param {Function} f
 * @returns {Array.<*>}
 */
function flatMap<T, U> (array: Array<T>, f: (x: T) => Array<U>): Array<U> {
  return [].concat(...array.map(x => f(x)))
}

/**
 * Given any number of `Set`s, return a new `Set` that contains all elements combined.
 * @param {...Set} sets
 * @returns {Set} - the union of `a` and `b`
 */
function setUnion<T> (...sets: Array<Set<T>>): Set<T> {
  const u = new Set()
  for (const s of sets) {
    for (const elem of s) {
      u.add(elem)
    }
  }
  return u
}

/**
 * Returns true if Set `a` and Set `b` contain the same members, using strict (shallow) equality (the `===` operator)
 * @param {Set} a
 * @param {Set} b
 * @returns {boolean}
 */
function setEquals<T> (a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const elem of a.values()) {
    if (!b.has(elem)) return false
  }
  return true
}

/**
 * Returns base58-encoded sha256 multihash for the given Buffer
 * @param {Buffer} buf - a `Buffer` you want to hash
 * @returns {string} a base58-encoded multihash string
 */
function b58MultihashForBuffer (buf: Buffer): string {
  const hash = crypto.createHash('sha256')
  hash.update(buf)

  const mh = Multihash.encode(hash.digest(), 'sha2-256')
  return Multihash.toB58String(mh)
}

/**
 * Returns true if `str` is a valid base58-encoded multihash
 * @param {string} str
 * @returns {boolean}
 */
function isB58Multihash (str: string): boolean {
  try {
    const h = Multihash.fromB58String(str)
    Multihash.validate(h)
    return true
  } catch (err) {
    return false
  }
}

/**
 * Print `output` to the `destination` stream and append a newline.
 * @param {string} output
 * @param {stream.Writable | tty.WriteStream} destination
 */
function writeln (output: string, destination: Writable | WriteStream) {
  destination.write(output + '\n')
}

/**
 * Print `output` to stdout and append a newline.
 * Always use this instead of console.log for non-debug output!
 * console.log keeps a strong reference to whatever you pass in,
 * which can result in memory leaks for long-running processes.
 * @param {string} output
 */
function println (output: string) {
  writeln(output, process.stdout)
}

/**
 * Print `output` to stderr and append a newline.
 * Use if you don't want console.error to keep a strong reference
 * to whatever you pass in.
 * @param {string} output
 */
function printlnErr (output: string) {
  writeln(output, process.stderr)
}

/**
 * Read a stream until it ends, returning its contents as a string.
 * @param {stream.Readable} stream
 * @returns {Promise}
 */
function consumeStream (stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('error', err => reject(err))
    stream.on('data', chunk => { chunks.push(chunk) })
    stream.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'))
    })
  })
}

/**
 * Returns a clone of `obj` with all `Buffer` objects replaced with their base64-encoded string equivalents
 * @param {object} obj
 * @returns {object}
 */
function stringifyNestedBuffers (obj: Object): Object {
  const replacer = obj => {
    if (obj instanceof Buffer) {
      return obj.toString('base64')
    }
  }

  return (_.cloneDeepWith(obj, replacer): any)
}

module.exports = {
  promiseHash,
  promiseTimeout,
  flatMap,
  setUnion,
  setEquals,
  b58MultihashForBuffer,
  isB58Multihash,
  writeln,
  println,
  printlnErr,
  consumeStream,
  stringifyNestedBuffers
}
