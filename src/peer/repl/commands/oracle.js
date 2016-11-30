// @flow

const os = require('os')
const { bootstrap } = require('../util')
const Web3 = require('web3');

module.exports = {
  command: 'oracle',
  describe: 'start an ethereum oracle\n',
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
          // TODO: actually we want to die here, given that we don't have discovery
          init = node.start()
        }

        // TODO: directory stuff
        if (node.directory == null) {
          // TODO: get directory from remote peer (and amend message below)
          console.log('No directory specified, running without directory')
        }

        init.then(() => {
          let web3 = new Web3()
          web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
          console.log(web3);
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
