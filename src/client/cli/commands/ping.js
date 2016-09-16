// @flow

const RestClient = require('../../api/RestClient');

const command = 'ping <peerId>';
const describe = 'ping a remote node';
const handler = ({peerId}) => {
    console.log('pinging peer: ', peerId);

    client = new RestClient({rootURL: 'http://localhost'});
    client.ping(peerId);
};

module.exports = {
    command,
    describe,
    handler,
};