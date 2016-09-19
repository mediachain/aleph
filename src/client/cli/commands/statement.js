// @flow

const util = require('util');
const RestClient = require('../../api/RestClient');

module.exports = {
    command: 'statement <statementId>',
    description: 'retrieve a statement by its id',
    handler: (opts: {statementId: string, apiUrl: string}) => {
        const {statementId, apiUrl} = opts;
        const client = new RestClient({rootUrl: apiUrl});

        client.statement(statementId)
            .then(
                statement => {
                    console.dir(statement, {colors: true});
                },
                err => {
                   console.error(err);
                });
    }
}
