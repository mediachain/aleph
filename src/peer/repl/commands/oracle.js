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
      .option('rpc', {
        'type': 'string',
        'describe': 'ethereum RPC host to connect to',
        // can use http://eth3.augur.net:8545 testnet public node
        'default': 'http://localhost:8545'
      })
      .option('namespace', {
        'alias': 'ns',
        'type': 'string',
        'describe': 'which namespace to act as oracle for',
        'demand': true
      })
      .help()
  },
  handler: (opts: {dir?: string, remotePeer?: string, identityPath: string, rpc: string}) => {
    const {remotePeer, rpc} = opts

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
          let web3 = initEth(rpc)
          if(!web3.isConnected()){
            // TODO: may need to sleep here?
            console.error(`Unable to connect to ethereum RPC:`, rpc)
            process.exit(-1)
          } else {
            console.log(`Connected to ethereum RPC:`, rpc)
            // ope.watch(orderPlacedHandler)
            // oce.watch(orderCompletedHandler)
          }
        }).catch(err => {
          console.log(err)
        })
      })
  }
}

function initEth(rpc: string): Web3 {
  const web3 = new Web3()
  web3.setProvider(new web3.providers.HttpProvider(rpc));
  return web3
}

function orderPlacedHandler(err, event) {
  // listen for OrderPlaced event, call completeOrder

  // registration (write)
  // token.completeOrder(config.namespace, thing,
  // config.namespaceOwner, {from: account});

  // lookup (read)
  // token.completeOrder(thing.id, buyer,
  // thing.owner, {from: account});
}

function orderCompletedHandler(err, event){
}