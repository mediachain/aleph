# א

[![Travis CI](https://travis-ci.org/mediachain/aleph.svg?branch=master)](https://travis-ci.org/mediachain/aleph.svg?branch=master)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)

The Aleph's diameter was probably little more than an inch, but all space was there, actual and undiminished. Each thing (a mirror's face, let us say) was infinite things, since I distinctly saw it from every angle of the universe[1]

1: http://www.phinnweb.org/links/literature/borges/aleph.html


Aleph is part of the [mediachain](http://mediachain.io) project and is an integral component of the
[Phase II architecture](https://blog.mediachain.io/looking-backwards-looking-forwards-9149bf00f876#.kkym75h9h).

Aleph provides two main components. First is a client for the HTTP API exposed by
[concat][concat], the reference go peer implementation.  Second, aleph is also a peer in its own right,

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

Thanks! We welcome all contributions of ideas, bug reports, code, and whatever else you'd like to send our way.
If things aren't working, please [file an issue](https://github.com/mediachain/aleph/issues), or reach out to
us on our Slack community: http://slack.mediachain.io

To set up a development environment, make sure you have node 6 installed. [nvm])(https://github.com/creationix/nvm)
may be helpful if you need to manage multiple node versions, or if your platform includes an ancient system version.

You'll likely also want to install [flow](https://flowtype.org), either from the
[latest release](https://github.com/facebook/flow/releases/latest), or, if you're on a Mac, with
[homebrew](https://brew.sh): `brew install flow`.  It's possible to build the project without flow,
but flow types are used pervasively throughout, and you might as well get the benefit of the analyzer :)

Once that's set up, `npm run build` will run the `src` directory through babel and output compiled code to the `lib`
directory.  At the moment babel is only used for removing flow type annotations from the compiled output, although
we may lean on it more as we target other execution environments (e.g., the browser).

If you're working on the `mcclient` code, you might want to use `npm run cli -- args for mcclient go after double dashes`, which will
compile the code before running the command.  Otherwise you need to remember to run `npm run build` before `mcclient`
to compile your changes.

### Style

Aleph is written in the [subset of ES2016 supported by node 6](http://node.green), with [flow type annotations](https://flowtype.org).
Code is formatted according to [standard.js rules](http://standardjs.com/), with plugins to make standard.js play
nice with flow.  The upshot is that you can use most fancy "next-gen" JS features, with the exception of
`async`/`await` and the "object spread" syntax (e.g. `const fooWithBar = {...foo, bar: 'baz'}`).  If you find
yourself needing the latter, you can use the "desugared" `const fooWithBar = Object.assign({}, foo, {bar: 'baz'})`.

Running `npm run check` will run both standard and flow, and it's good to get into the habit of running it
periodically to catch any type errors, etc.  If you want, you can force the habit upon yourself by using the
`pre-push.sh` git hook, which can be installed with `cd .git/hooks && ln -s ../../pre-push.sh pre-push`.  The
pre-push hook will also run the unit tests with `npm run test` to try to catch any regressions.

That said, please don't let type checkers or style guides discourage you from contributing!  If you'd rather not
mess about with pleasing our nitpick bots, just open a PR and we can help sort it out and get it merged in.

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