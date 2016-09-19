// @flow

const RestClient = require('../../api/RestClient');

module.exports = {
    command: 'id',
    description: 'request the peer id of the connected peer',
    handler: (opts: {peerUrl: string}) => {
        const {peerUrl} = opts;
        const client = new RestClient({peerUrl});
        client.id().then(response => {
            console.log(response);
        });
    }
};
