// @flow

const RestClient = require('../api/RestClient');

const argv = require('yargs')
    .option('apiUrl', {
        alias: 'a',
        description: 'root URL of the REST API for a mediachain node',
        default: 'http://localhost:9002'
    })
    .global('apiUrl')
    .commandDir('commands')
    .argv;


// console.log('args: ', argv);