// @flow

const Node = require('../../node')
const Repl = require('repl')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Identity = require('../../identity')
//const config = require('./config')

import type { MediachainNodeOptions } from '../../node'

module.exports = {
  command: 'repl',
  describe: 'start the aleph repl\n',
  builder: (yargs: Function) => {
    return yargs
      .option('dirInfo', {
        'alias': 'd',
        'type': 'string',
        'describe': 'directory to connect to',
        'demand': false
      })
      .help()
  },
  handler: (opts: {dirInfo: string}) => {
    const {dirInfo} = opts

    const options = bootstrap()
    const node = new Node(options)

    if(dirInfo !== undefined){
      // FIXME: this needs to actually parse the address
      node.setDirectory(dirInfo)
    }

    repl = Repl.start({
      'prompt': 'א > ',
      'useColors': true,
      'ignoreUndefined': true
    })
    repl.context.node = node
  }
}

function bootstrap(): MediachainNodeOptions {
  const options = {
    peerId: Identity.generateIdentity(),
    dirInfo: 'aleph client node'
  }

  return options
}
