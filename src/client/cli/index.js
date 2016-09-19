// @flow

const RestClient = require('../api/RestClient');

const argv = require('yargs')
    .usage('Usage: $0 [options] <command> [command-options]')
    .help()
    .example('$0 ping QmF00123', 'send a ping message to peer with id QmF00123')
    .demand(1, 'Missing command argument')
    .option('peerUrl', {
        alias: 'p',
        description: 'root URL of the REST API for a mediachain node',
        default: 'http://localhost:9002'
    })
    .global('peerUrl')
    .commandDir('commands')
    .argv;


// console.log('args: ', argv);