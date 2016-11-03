// @flow

const Multihash = require('multihashes')
const { JQ_PATH } = require('../../metadata/jqStream')
const childProcess = require('child_process')

function printJSON (obj: Object,
                    options: {color?: ?boolean, pretty?: boolean} = {}) {
  const compactOutput = options.pretty === false

  let useColor = false
  // print in color if explicitly enabled, or if pretty-printing to a tty
  if (options.color === true || (options.color == null && process.stdout.isTTY && !compactOutput)) {
    useColor = true
  }

  const jqOpts = [(useColor ? '-C' : '-M'), '-a', '.']
  if (options.pretty === false) {
    jqOpts.unshift('-c')
  }

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
  printJSON,
  pluralizeCount,
  isB58Multihash
}
