// @flow

const ChildProcessStream = require('duplex-child-process')
const byline = require('byline')
const path = require('path')
const JQ_PATH = path.join(__dirname, '..', '..', 'bin', 'jq')

class JQTransform extends ChildProcessStream {
  _args: Array<string>

  constructor (filter: string) {
    super({encoding: 'utf-8'})
    this._args = [
      '-a', // ascii output (escape unicode characters)
      '-c', // compact (no pretty print)
      '-M', // monochrome output
      '-S', // sort object keys
      filter  // don't need to escape input, since child_process.spawn doesn't use a subshell
    ]

    // overwrite the _reader member of superclass to return results line-by-line
    this._reader = byline(this._reader)

    // do the thing
    this.spawn(JQ_PATH, this._args)
  }
}

module.exports = {
  JQTransform,
  JQ_PATH
}
