# א

[![Travis CI](https://travis-ci.org/mediachain/aleph.svg?branch=master)](https://travis-ci.org/mediachain/aleph.svg?branch=master)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)

*The Aleph's diameter was probably little more than an inch, but all space was there, actual and undiminished. Each thing (a mirror's face, let us say) was infinite things, since I distinctly saw it from every angle of the universe[¹]*


Aleph is part of the [mediachain](http://mediachain.io) project and is an integral component of the
[Phase II architecture](https://blog.mediachain.io/looking-backwards-looking-forwards-9149bf00f876#.kkym75h9h).

Aleph provides two main components. First is a client for the HTTP API exposed by
[concat][concat], the reference go peer implementation. Second is a lightweight peer in its own right.

## Installation

Aleph requires node 6 or greater, and has primarily been tested with 6.5 and above.

To globally install a release from npm: `npm install --global aleph`.  This will install the `mcclient` command,
which you can use to control and interact with a [concat][concat] node.

If you'd prefer to install from the source repository, clone this repo and run `npm install`, followed by
`npm link`, which will create an `mcclient` symlink that runs the latest compiled version of the code.
This is very useful during development.

If you don't want `mcclient` on your path at all, you can just run `npm install` and execute `./bin/mcclient.js`
directly instead.

## Usage

`mcclient` is a wrapper around the HTTP API exposed by [concat][concat], aleph's heavy-lifting counterpart.

`mcclient` contains several sub-commands, so the general invocation is
`mcclient [global-options] <command> [command-options]`.

At the moment, the only global option is `--peerUrl` or `-p`, which sets the location of the remote node's
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
