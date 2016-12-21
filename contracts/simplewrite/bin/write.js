var Web3 = require('web3');
var web3 = new Web3();
var config = require('../src/config.json');
var request = require('request-promise');


var provider = new web3.providers.HttpProvider(config.ethRpcUrl);
web3.setProvider(provider);
var accounts = web3.eth.accounts;

var artist = accounts[1];
var deposit = 1e5;
    
console.log(artist, 'will register a thing');
var options = {
	method: 'POST',
	uri: `http://localhost:8080/api/${config.namespace}/things/register`,
	body: {
    name: "thing A",
    owner: artist,
    url: "https://example.com/a.mp3",
	},
	json: true,
};

var thing;
request(options)
	.then(function(_thing) {
    thing = _thing;
    console.log(thing);
	})
  .then(function() {
    return token.write
      .sendTransaction('mediachain', thing.id,
       {from: artist, value: 0, gas: 1000000})
  
  })
	.then(console.log)
