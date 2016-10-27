// @flow

const Multihash = require('multihashes')

function prettyPrint (obj: Object) {
  // for now, use console.dir to dump the object.
  // when we have a hard dependency on jq, we can just pipe through it instead :)
  console.dir(obj, {colors: true, depth: 1000})
}

function pluralizeCount (count: number, word: string): string {
  let plural = word
  if (count !== 1) plural += 's'
  return count.toString() + ' ' + plural
}

function isB58Multihash (str: string): boolean {
  try {
    Multihash.fromB58String(str)
    return true
  } catch (err) {
    return false
  }
}

module.exports = {
  prettyPrint,
  pluralizeCount,
  isB58Multihash
}
