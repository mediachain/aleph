// @flow

const RestClient = require('../../api/RestClient');

module.exports = {
    command: 'id',
    description: 'request the peer id of the connected peer',
    handler: (opts: {apiUrl: string}) => {
        const {apiUrl} = opts;
        const client = new RestClient({rootUrl: apiUrl});
        client.id().then(response => {
            console.log(response);
        });
    }
};
