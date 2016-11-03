// @flow

const Multihash = require('multihashes')
const { JQ_PATH } = require('../../metadata/jqStream')
const childProcess = require('child_process')

function prettyPrint (obj: Object, options: {color: boolean | 'auto'} = {color: 'auto'}) {
  let useColor = false
  if (options.color === true || (options.color === 'auto' && process.stdout.isTTY)) {
    useColor = true
  }

  const jqOpts = [(useColor ? '-C' : '-M'), '-a', '.']
  const output = childProcess.execFileSync(JQ_PATH, jqOpts, {input: JSON.stringify(obj), encoding: 'utf-8'})
  console.log(output)
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
