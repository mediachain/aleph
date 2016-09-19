// @flow

const idCommand = require('./commands/id');
const pingCommand = require('./commands/ping');

const argv = require('yargs')
    .option('apiUrl', {
        alias: 'a',
        description: 'root URL of the REST API for a mediachain node',
        default: 'http://localhost:9002'
    })
    .global('apiUrl')
    .command(idCommand)
    .command(pingCommand)
    .argv;


// console.log('args: ', argv);