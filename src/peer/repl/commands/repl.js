// @flow

const os = require('os')
const { MediachainNode: Node, RemoteNode } = require('../../node');
// $FlowIssue flow doesn't find repl builtin?
const Repl = require('repl')
const Identity = require('../../identity')

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

    let init, remotePeerInfo, remote
    if(remotePeer !== undefined){
      remotePeerInfo = Identity.inflateMultiaddr(remotePeer)
      remote = RemoteNode(node)

      init = node.start().then(() => {
        node.openConnection(remotePeerInfo)
      }).then(() => {
        console.log("Connected to " + remotePeer)
      })

    } else {
      console.log("No remote peer specified, running in detached mode")
      // TODO: create dummy RemoteNode class that just throws
      init = Promise.resolve()
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
      repl.context.remote = remote
      const defaultEval = repl.eval
      repl.eval = promiseEval(defaultEval)
    }).catch(err => {
      console.log(err)
    })
  }
}

const EMPTY = '(' + os.EOL + ')'
const promiseEval = (defaultEval) => (cmd, context, filename, callback) => {
  if (cmd === EMPTY) return callback()
  defaultEval(cmd, context, filename, (err, result) => {
    if (err) { return callback(err) }

    if (result instanceof Promise) {
      result.then(
        asyncResult => { callback(null, asyncResult) },
        asyncErr => { callback(asyncErr) }
      )
    } else {
      callback(null, result)
    }
  })
}

function bootstrap (opts: {identityPath: string}): MediachainNodeOptions {
  const {identityPath} = opts

  const options = {
    peerId: Identity.loadOrGenerateIdentity(identityPath),
    dirInfo: 'aleph client node'
  }

  return options
}
