// @flow

const rest = require('rest');
const mime = require('rest/interceptor/mime');

class RestClient {
    rootUrl: string;
    client: Function;

    constructor(options: {rootUrl?: string}) {
        let {rootUrl} = options;
        this.rootUrl = rootUrl || '';
        this.client = rest.wrap(mime);
    }

    getRequest(path: string): Promise<Object> {
        const absPath = path.startsWith('/') ? path : '/' + path;
        const url = this.rootUrl + absPath;
        return this.client(url);
    }

    id(): Promise<string> {
        return this.getRequest('id')
            .then(response => response.entity);
    }

    ping(peerId: string): Promise<bool> {
        return this.getRequest(`ping/${peerId}`)
            .then(response => {
                return response.status.code == 200;
            })
    }
}

module.exports = RestClient;