// @flow

const os = require('os')
// $FlowIssue flow doesn't find repl builtin?
const Repl = require('repl')
const { bootstrap } = require('../util')

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
  handler: (opts: {dir?: string, remotePeer?: string, identityPath: string}) => {
    const {remotePeer} = opts

    bootstrap(opts)
      .catch(err => {
        console.error(`Error setting up aleph node: ${err.message}`)
        process.exit(1)
      })
      .then(({node, remote}) => {
        let init
        if (remote != null) {
          init = node.start()
            .then(() => node.openConnection(remote.remotePeerInfo))
            .then(() => { console.log(`Connected to `, remotePeer) })
        } else {
          console.log('No remote peer specified, running in detached mode')
          // TODO: create dummy RemoteNode class that just throws
          init = node.start()
        }

        // TODO: directory stuff
        if (node.directory == null) {
          // TODO: get directory from remote peer (and amend message below)
          console.log('No directory specified, running without directory')
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
          repl.on('exit', () => {
            process.exit()
          })
        }).catch(err => {
          console.log(err)
        })
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
