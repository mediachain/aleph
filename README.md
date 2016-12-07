# א

[![npm version](https://badge.fury.io/js/aleph.svg)](https://badge.fury.io/js/aleph)
[![Travis CI](https://travis-ci.org/mediachain/aleph.svg?branch=master)](https://travis-ci.org/mediachain/aleph.svg?branch=master)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)

*The Aleph's diameter was probably little more than an inch, but all space was there, actual and undiminished. Each thing (a mirror's face, let us say) was infinite things, since I distinctly saw it from every angle of the universe[¹]*


Aleph is part of the [mediachain](http://mediachain.io) project and is an integral component of the
[Phase II architecture](https://blog.mediachain.io/looking-backwards-looking-forwards-9149bf00f876#.kkym75h9h).

Aleph provides two main components. First is a client for the HTTP API exposed by
[concat][concat], the reference go peer implementation. Second is a lightweight peer in its own right.

For system-wide Mediachain documentation see https://mediachain.github.io/mediachain-docs.

## Installation

Aleph requires node 6 or greater, and has primarily been tested with 6.5 and above.

To globally install a release from npm: `npm install --global aleph`.  This will install the `aleph` command, which
provides a remote query command and an interactive REPL for exploring the mediachain network.  It also
installs the `mcclient` command, which you can use to control and interact with a [concat][concat] node.  

If you'd prefer to install from the source repository, clone this repo and run `npm install`, followed by
`npm link`, which will create a `mcclient` and `aleph` symlinks that run the latest compiled version of the code.
This is very useful during development.

If you don't want `mcclient` or `aleph` on your path at all, you can just run `npm install` and execute 
`./bin/mcclient.js` and `./bin/aleph.js` directly instead.

## Usage

Installing the `aleph` package will install two command line tools: `mcclient` and `aleph`.

### `mcclient`

`mcclient` is a wrapper around the HTTP API exposed by [concat][concat], aleph's heavy-lifting counterpart.

`mcclient` contains several sub-commands, so the general invocation is
`mcclient [global-options] <command> [command-options]`.

At the moment, the only global option is `--apiUrl` or `-p`, which sets the location of the remote node's
HTTP API. By default, `mcclient` will attempt to connect to a concat node running on localhost at port 9002,
which is concat's default listen address for the HTTP API.  If you've configured concat to run on a different
port or on a remote machine, use the `-p` flag to pass in a new URL, e.g. `mcclient -p http://localhost:5678 id`

Some useful commands include:

- `id`: print the node's peer id and publisher id
- `status`:
  - with no arguments, prints the current status (`online`, `offline`, or `public`)
  - set the status with e.g. `mcclient status online`
- `publish`: publish JSON metadata to the node's local store. see `mcclient publish --help` for more info.
- `statement`: retrieve a statement by its id
- `query`: run a mediachain query against the node's local store.

To see a full list of supported commands, run `mcclient --help`

### `aleph`

While `mcclient` is a front-end for the golang peer implementation [concat][concat], the `aleph` command provides
access to the javascript peer implementation.  The two are interoperable, but they do not have
feature parity.  Most notably, the javascript peer has no local storage for mediachain statements or data objects,
so it can't be used to provide mediachain data.  However, `aleph` is useful for interacting with local and remote
`concat` nodes, and for exploring the mediachain network and peer-to-peer architecture.

There are currently two `aleph` subcommands, `aleph repl` and `aleph query`

#### `aleph repl`

The `aleph repl` command provides an interactive Read-Eval-Print-Loop for controlling a javascript mediachain node.
When you start the repl, a new peer identity is created and stored in the `~/.mediachain/aleph` directory.  You can
override that default with the `--identityPath` flag.

The repl provides a javascript prompt, and a global `node` object.  This is an instance of the 
[`MediachainNode` class](https://github.com/mediachain/aleph/src/peer/node.js), which implements the peer-to-peer
protocols.

The repl can be used to remotely interact with another node using the mediachain protocol.
For example:

```javascript
א > node.ping('/ip4/54.205.184.122/tcp/9001/p2p/QmeiY2eHMwK92Zt6X4kUUC3MsjMmVb2VnGZ17DhnhRPCEQ')
true
```

The long string above is a [multiaddr](https://github.com/multiformats/multiaddr/), which is a format
for representing and combining addresses for multiple network protocols.  The string above is for
the peer-to-peer node with id `QmeiY2eHMwK92Zt6X4kUUC3MsjMmVb2VnGZ17DhnhRPCEQ`, located at the IP4 address
`54.205.184.122`, on tcp port `9001`.  The `/p2p/` protocol identifier is not yet part of the multiaddr standard,
but it is [in the works](https://github.com/multiformats/multiaddr/pull/27) as a replacement for the `/ipfs/` identifier, and we've adopted it in anticipation of it being
integrated into the standard soon.

Let's make our addresses a bit simpler by connecting to the Mediachain Labs directory server:

```javascript
א > node.setDirectory('/ip4/52.7.126.237/tcp/9000/p2p/QmSdJVceFki4rDbcSrW7JTJZgU9so25Ko7oKHE97mGmkU6')
```

Now we can just use the peer identifier portion of the address, and the directory will provide us with
the full address behind the scenes:

```javascript
א > node.ping('QmeiY2eHMwK92Zt6X4kUUC3MsjMmVb2VnGZ17DhnhRPCEQ')
true
```

You can also provide the directory server address at the command line when launching the repl:

```bash
$ aleph repl --dir /ip4/52.7.126.237/tcp/9000/p2p/QmSdJVceFki4rDbcSrW7JTJZgU9so25Ko7oKHE97mGmkU6
```

This will set the directory address on startup, and avoid the need for the `node.setDirectory` call.

##### Pairing a remote node

Since the aleph repl is at its most useful when interacting with a remote node, there's built-in
support for "pairing" the javascript aleph node to a remote node (most likely a `concat` node).

To do so, just provide the `--remotePeer` flag when launching the repl, and give it a multiaddr where
the peer is located:

```bash
$ aleph repl --remotePeer /ip4/54.205.184.122/tcp/9001/p2p/QmeiY2eHMwK92Zt6X4kUUC3MsjMmVb2VnGZ17DhnhRPCEQ
```

Now, in addition to the global `node` object, you also have a `remote` object that represents the
 remote peer.
 
```javascript
א > remote.query('SELECT * FROM images.dpla LIMIT 1')
[ { value: { simple: [Object] } } ]

```

The query result is printed at the repl in condensed form.  To examine it further, we can use the "magic" `_` variable,
which holds the result of the last repl command.  Assign it to a new variable, and we can interact with it more easily:

```javascript
var result = _
console.dir(result[0].value.simple)
{ stmt: 
   { id: '4XTTM4K8sqTb7xYviJJcRDJ5W6TpQxMoJ7GtBstTALgh5wzGm:1478267497:1',
     publisher: '4XTTM4K8sqTb7xYviJJcRDJ5W6TpQxMoJ7GtBstTALgh5wzGm',
     namespace: 'images.dpla',
     body: 
      { simple: 
         { object: 'QmeFJSTPKSEiNqebxZvYcduWH8UBmxqNq724gHEQnxV5D1',
           refs: [ 'dpla_1ff6b36174426026847c8f8ca216ffa9' ],
           tags: [],
           deps: [ 'QmYGRQYmWC3BAtTAi88mFb7GVeFsUKGM4nm25SBUB9vfc9' ] } },
     timestamp: 1478267497,
     signature: 
      Buffer [...] } }
```

To also fetch the data objects associated with each result, use `remote.queryWithData` instead of `remote.query`.

#### `aleph query`

`aleph query --remotePeer <peerAddress> <queryString>` will execute a query on a remote peer using the peer-to-peer
 query protocol.  This is very similar to the `mcclient query` command, with the exception that the `--remotePeer`
 argument is not optional, since the local aleph node does not have a local datastore.
 
Mediachain records are composed of two main components: statements and objects. Objects are the core metadata objects
 that represent a given artwork, person, or other resource.  A statement is a mediachain-specific record that 
 contextualizes an object within the mediachain network.  For example, the statement includes the namespace in which
 the record was published, the ids of the publisher, the well-known identifiers attached to the record, etc.
 
By default, the `aleph query` command will only show the statements that match the query results.  However, it's
common that you'll want to see the content of the objects themselves.

Use the `--includeData` or `-i` flag to dereference the objects for each statement in the query results.
For example:

```bash
$ aleph query --remotePeer /ip4/54.205.184.122/tcp/9001/ipfs/QmeiY2eHMwK92Zt6X4kUUC3MsjMmVb2VnGZ17DhnhRPCEQ --includeData 'SELECT * FROM images.dpla LIMIT 1' 
```

```json
{
  "simple": {
    "stmt": {
      "id": "4XTTM4K8sqTb7xYviJJcRDJ5W6TpQxMoJ7GtBstTALgh5wzGm:1478267497:1",
      "publisher": "4XTTM4K8sqTb7xYviJJcRDJ5W6TpQxMoJ7GtBstTALgh5wzGm",
      "namespace": "images.dpla",
      "body": {
        "simple": {
          "object": {
            "key": "QmeFJSTPKSEiNqebxZvYcduWH8UBmxqNq724gHEQnxV5D1",
            "data": {
              "schema": {
                "/": "QmYGRQYmWC3BAtTAi88mFb7GVeFsUKGM4nm25SBUB9vfc9"
              },
              "data": {
                "artist_names": [
                  [
                    "Meredith L. Clausen"
                  ]
                ],
                "aspect_ratio": 0.7166666666666667,
                "attribution": [
                  {
                    "name": "Meredith L. Clausen"
                  }
                ],
                "omitted_for_bevity": "..."
              }
            }
          },
          "refs": [
            "dpla_1ff6b36174426026847c8f8ca216ffa9"
          ],
          "tags": [],
          "deps": [
            "QmYGRQYmWC3BAtTAi88mFb7GVeFsUKGM4nm25SBUB9vfc9"
          ]
        }
      },
      "timestamp": 1478267497,
      "signature": "yDhPpc/RIkW3+sHjl/cB00j3jurqMsDdb/tUyVMUfa6I4EnNiYdSqasxWTiRGtsaT2M/xX++RgRNQQ/97x8IDA=="
    }
  }
}

```
  
## Development and contribution

Thanks! We welcome all contributions of ideas, bug reports, code, and whatever else you'd like to send our way. Please take a look at our [contributing guidelines](CONTRIBUTING.md) -- they are very friendly.

### Code structure

The code lives in `src`, and is organized into a few main subdirectories:
- `client/api` contains the `RestClient` class, which provides a Promise-based wrapper around concat's HTTP API
- `client/cli` contains the code for the `mcclient` command line app, which uses `RestClient` for all of its
  functionality.  The cli is powered by the [yargs argument parser](http://yargs.js.org/), and each subcommand
  is contained in its own module in `client/cli/commands`
- `peer` contains the javascript implementation of mediachain peer-to-peer nodes.  There are two main node types,
  a `DirectoryNode` that corresponds to concat's `mcdir` command, and a `MediachainNode` that corresponds to
  concat's `mcnode`.  Both use the `LibP2PNode` class (defined in [src/peer/libp2p_node.js](https://github.com/mediachain/aleph/master/src/peer/libp2p_node.js))
  for low-level peer-to-peer networking.
- `protobuf` contains protocol-buffer definitions for messages exchanged between nodes, and is kept in sync with
  concat.



[concat]: https://github.com/mediachain/concat
[¹]: http://www.phinnweb.org/links/literature/borges/aleph.html
