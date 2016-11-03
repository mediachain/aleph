// @flow

const Node = require('../../node')
// $FlowIssue flow doesn't find repl builtin?
const Repl = require('repl')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Identity = require('../../identity')
const Promirepl = require('promirepl')

import type { MediachainNodeOptions } from '../../node'

module.exports = {
  command: 'repl',
  describe: 'start the aleph repl\n',
  builder: (yargs: Function) => {
    return yargs
      .option('dir', {
        'alias': 'd',
        'type': 'string',
        'describe': 'directory to connect to (multiaddress)',
        'demand': false
      })
      .help()
  },
  handler: (opts: {dir: string, remotePeer: string, identityPath: string}) => {
    const {dir, remotePeer} = opts

    const options = bootstrap(opts)
    const node = new Node(options)

    const commands = {}

    let init, remotePeerInfo
    if(remotePeer !== undefined){
      remotePeerInfo = Identity.inflateMultiaddr(remotePeer)

      commands.remoteQuery = function(queryString){
        return node.remoteQuery(remotePeerInfo, queryString)
      }

      init = node.start().then(() => {
        node.openConnection(remotePeerInfo)
      }).then(() => {
        console.log("Connected to " + remotePeer)
      })

    } else {
      console.log("No remote peer specified, running in detached mode")
      init = Promise.resolve(undefined)
    }

    // TODO: directory stuff
    if(dir !== undefined){
      const dirInfo = Identity.inflateMultiaddr(dir)
      node.setDirectory(dirInfo)
    } else if(false){
      // TODO: get directory from remote peer (and amend message below)
    } else {
      console.log("No directory specified, running without directory")
    }

    init.then(() => {
      const repl = Repl.start({
        'prompt': 'א > ',
        'useColors': true,
        'ignoreUndefined': true
      })
      repl.context.node = node
      repl.context.commands = commands
      //Promirepl.promirepl(repl)
    }).catch(err => {
      console.log(err)
    })
  }
}

function bootstrap(opts: {identityPath: string}): MediachainNodeOptions {
  const {identityPath} = opts

  const options = {
    peerId: Identity.loadOrGenerateIdentity(identityPath),
    dirInfo: 'aleph client node'
  }

  return options
}
