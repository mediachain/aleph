// @flow

const Node = require('../../node')
const repl = require('repl')

module.exports = {
  command: 'repl',
  describe: 'start the aleph repl\n',
  handler: (opts: {directory: string}) => {
    const {directory} = opts

    repl.start('א > ')
  }
}
