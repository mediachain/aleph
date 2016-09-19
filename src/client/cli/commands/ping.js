// @flow

const RestClient = require('../../api/RestClient');

module.exports = {
    command: 'ping <peerId>',
    describe: 'ping a remote node',
    handler: (opts: {peerId: string, apiUrl: string}) => {
        const {peerId, apiUrl} = opts;
        console.log('pinging peer: ', peerId);

        const client = new RestClient({rootUrl: apiUrl});
        client.ping(peerId)
            .then(success => {
                let msg = success ? 'OK' : 'failed';
                console.log(`ping result: ${msg}`);
            });
    },
};