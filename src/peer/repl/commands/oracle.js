// @flow

const os = require('os')
const { bootstrap } = require('../util')
const Web3 = require('web3');

type OracleOpts = {
  dir?: string,
  remotePeer?: string,
  identityPath: string,
  contractPath: string,
  rpc: string
}

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
  handler: (opts: OracleOpts) => {
    const {remotePeer, rpc, contractPath} = opts

    bootstrap(opts)
      .catch(err => {
        console.error(`Error setting up aleph node: ${err.message}`)
        process.exit(1)
      })
      .then(({node, remote}) => {
        let init

        // load contract
        // $FlowIssue let this slide for now
        const writer = require(contractPath)

        // connect to paired concat
        if (remote != null) {
          init = node.start()
            .then(() => node.openConnection(remote.remotePeerInfo))
            .then(() => { console.log(`Connected to `, remotePeer) })
        } else {
          console.log('No remote peer specified, running in detached mode')
          init = node.start()
        }

        // TODO: directory stuff
        if (node.directory == null) {
          console.log('No directory specified, running without directory')
        }

        init.then(() => {
          // connect to ethereum and find deployed contract
          const web3 = new Web3()
          web3.setProvider(new web3.providers.HttpProvider(rpc))
          writer.setProvider(web3.currentProvider)
          const we = writer.deployed().Write()

          if(!web3.isConnected()){
            console.error(`Unable to connect to ethereum RPC:`, rpc)
            process.exit(-1)
          } else {
            console.log(`Connected to ethereum RPC:`, rpc)
            we.watch(orderPlacedHandler)
          }
        }).catch(err => {
          console.log(err)
        })
      })
  }
}

function orderPlacedHandler(err, event) {
  if(err){
    console.error(err)
  } else {
    console.log(event)
  }
}
