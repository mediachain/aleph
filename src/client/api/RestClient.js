// @flow

const rest = require('rest');
const mime = require('rest/interceptor/mime');

class RestClient {
    constructor(options: {rootURL?: string}) {
        let {rootURL} = options;
        this.rootURL = rootURL || '';
        this.client = rest.wrap(mime);
    }

    ping(peerId) {
        this.client(`${this.rootURL}/ping/${peerId}`).then(response => {
            console.log(`ping response for ${peerId}: `, response);
        });
    }
}

module.exports = RestClient;