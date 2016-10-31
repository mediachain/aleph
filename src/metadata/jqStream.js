// @flow

const ChildProcessStream = require('duplex-child-process')
const byline = require('byline')

class JQTransform extends ChildProcessStream {
  _args: Array<string>

  constructor (filter: string) {
    super({encoding: 'utf-8'})
    this._args = [
      '-c', // compact (no pretty print)
      '-M', // monochrome output
      '-S', // sort object keys
      filter  // don't need to escape input, since child_process.spawn doesn't use a subshell
    ]

    // overwrite the _reader member of superclass to return results line-by-line
    this._reader = byline(this._reader)

    // do the thing
    this.spawn('jq', this._args)
  }
}

module.exports = {
  JQTransform
}
