// @flow

const Multihashing = require('multihashing')
import type { Writable, Readable } from 'stream'
import type { WriteStream } from 'tty'

/**
 * ES6+ implementation of rsvp's Promise.hash method:
 * https://github.com/tildeio/rsvp.js/#hash-of-promises
 * @param hash a JS object whose values may be `Promise`s
 * @returns {object} a JS object with the same keys as `hash`, whose values are
 *          the resolved values of that key's promise.  If any promise fails,
 *          the whole thing will fail.
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
 * @param timeout milliseconds to wait before rejecting
 * @param promise a promise that you want to set a timeout for
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
 */
function flatMap<T, U> (array: Array<T>, f: (x: T) => Array<U>): Array<U> {
  return [].concat(...array.map(x => f(x)))
}

/**
 * Returns base58-encoded sha256 multihash for the given Buffer
 * @param buf - a `Buffer` you want to hash
 * @returns {string} a base58-encoded multihash string
 */
function b58MultihashForBuffer (buf: Buffer): string {
  return Multihashing.multihash.toB58String(
    Multihashing(buf, 'sha2-256')
  )
}

/**
 * Returns true if `str` is a valid base58-encoded multihash
 */
function isB58Multihash (str: string): boolean {
  try {
    Multihashing.multihash.fromB58String(str)
    return true
  } catch (err) {
    return false
  }
}

/**
 * Print `output` to the `destination` stream and append a newline.
 * @param output
 * @param destination
 */
function writeln (output: string, destination: Writable | WriteStream) {
  destination.write(output + '\n')
}

/**
 * Print `output` to stdout and append a newline.
 * Always use this instead of console.log for non-debug output!
 * console.log keeps a strong reference to whatever you pass in,
 * which can result in memory leaks for long-running processes.
 * @param output
 */
function println (output: string) {
  writeln(output, process.stdout)
}

/**
 * Print `output` to stderr and append a newline.
 * Use if you don't want console.error to keep a strong reference
 * to whatever you pass in.
 * @param output
 */
function printlnErr (output: string) {
  writeln(output, process.stderr)
}

/**
 * Read a stream until it ends, returning its contents as a string.
 * @param stream
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

module.exports = {
  promiseHash,
  promiseTimeout,
  flatMap,
  b58MultihashForBuffer,
  isB58Multihash,
  writeln,
  println,
  printlnErr,
  consumeStream
}
