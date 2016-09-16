
const argv = require('yargs')
    .command(require('./commands/ping'))
    .argv;

console.log(argv);