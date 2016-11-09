// @flow

const os = require('os')
const vm = require('vm')
const Node = require('../../node')
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
      const defaultEval = repl.eval
      repl.eval = promiseEval(defaultEval)
    }).catch(err => {
      console.log(err)
    })
  }
}


/**
 * Helper to perform assignment in the repl. The idea is that, in the promiseEval wrapper,
 * we check if command is assigning to a var.  If so, we first evaluate just the right-hand
 * side of the assignment and check if the result is a Promise.  If it is, we perform
 * the assignment *after* the promise resolves.
 *
 * @param context - the vm.context for the REPL evaluator
 * @param assignmentFragment - the part of the command up to and including the `=`
 * @param result - the evaluated result of the right-hand side of the assignment statement
 */
function performAssignment (context: Object, assignmentFragment: ?string, result: any) {
  if (assignmentFragment != null) {
    const oldVal = context[REPL_ASSIGNMENT_KEY] // just in case the user defines a var with that key
    const assignCommand = assignmentFragment + REPL_ASSIGNMENT_KEY + ';'
    context[REPL_ASSIGNMENT_KEY] = result
    vm.runInContext(assignCommand, context)
    context[REPL_ASSIGNMENT_KEY] = oldVal
  }
}

const EMPTY = '(' + os.EOL + ')'
const ASYNC_ASSIGN_REGEX = /(.*\S+\s*[^=!><]=[^=>]\s*)await(.*)/
const REPL_ASSIGNMENT_KEY = '_AlephREPLResult'

const promiseEval = (defaultEval) => (cmd, context, filename, callback) => {
  if (cmd === EMPTY) return callback()

  const assignmentMatch = ASYNC_ASSIGN_REGEX.exec(cmd)
  let assignmentFragment: ?string = null
  if (assignmentMatch !== null && assignmentMatch.length > 2) {
    assignmentFragment = assignmentMatch[1]
    cmd = '(' + assignmentMatch[2] + ')'
  }

  defaultEval(cmd, context, filename, (err, result) => {
    if (err) { return callback(err) }

    if (result instanceof Promise) {
      result.then(
        asyncResult => {
          performAssignment(context, assignmentFragment, asyncResult)
          callback(null, asyncResult)
        },
        asyncErr => { callback(asyncErr) }
      )
    } else {
      performAssignment(context, assignmentFragment, result)
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
