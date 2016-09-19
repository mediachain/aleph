// @flow

const RestClient = require('../../api/RestClient');

module.exports = {
    command: 'publish <namespace> <statement>',
    description: 'publish a statement',
    builder: (yargs: any): any => {
        return yargs.coerce('statement', JSON.parse)
    },

    handler: (opts: {namespace: string, apiUrl: string, statement: Object}) => {
        const {namespace, apiUrl, statement} = opts;
        const client = new RestClient({rootUrl: apiUrl});

        client.publish(namespace, statement)
            .then(
                response => { console.log(response); },
                err => { console.error(err); }
            );
    }
}
