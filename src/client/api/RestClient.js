// @flow

const rest = require('rest');
const errorCode = require('rest/interceptor/errorCode');

import type { Statement, SimpleStatement } from '../../types/statement';

class RestClient {
    rootUrl: string;
    client: Function;

    constructor(options: {rootUrl?: string}) {
        let {rootUrl} = options;
        this.rootUrl = rootUrl || '';
        this.client = rest
            .wrap(errorCode);
    }

    _makeUrl(path: string): string {
        const absPath = path.startsWith('/') ? path : '/' + path;
        return this.rootUrl + absPath;
    }

    getRequest(path: string): Promise<Object> {
        return this.client(this._makeUrl(path));
    }

    postRequest(path: string, body: Object): Promise<Object> {
        return this.client({
            path: this._makeUrl(path),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            entity: JSON.stringify(body)
        });
    }

    id(): Promise<string> {
        return this.getRequest('id')
            .then(response => response.entity);
    }

    ping(peerId: string): Promise<bool> {
        return this.getRequest(`ping/${peerId}`)
            .then(response => true)
    }

    publish(namespace: string, statement: SimpleStatement): Promise<Object> {
        console.log(`publishing ${JSON.stringify(statement)} to ${namespace}`);
        return this.postRequest(`publish/${namespace}`, statement)
            .then(response => response.entity);
    }
}

module.exports = RestClient;
