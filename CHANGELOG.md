## 2016-02-13: aleph-v1.6.0
aleph-v1.6.0

mcclient:
- Added `manifest lookup` command to list signed manifests for a given entity id [PR #175](https://github.com/mediachain/aleph/pull/175)
- Added `net find` command to discover peers via DHT rendezvous [PR #180](https://github.com/mediachain/aleph/pull/180)

aleph:
- Friendlier REPL interactions thanks to internal refactor of Statement and QueryResult types [PR #177](https://github.com/mediachain/aleph/pull/177)
- Internal refactor of classes used for signature calculation / verification [PR #168](https://github.com/mediachain/aleph/pull/168)
- Refactored Statement API to have clear distinction between signed and unsigned Statements [PR #179](https://github.com/mediachain/aleph/pull/179)
- Added JSDoc comments to most public classes and methods in `src/peer`, with generated HTML API docs [PR #182]
- Greatly improved test coverage [PR #173](https://github.com/mediachain/aleph/pull/173)
- Removed outdated dependencies [PR #172](https://github.com/mediachain/aleph/pull/172), [PR #181](https://github.com/mediachain/aleph/pull/181)

## 2016-01-18: aleph-v1.5.1

aleph:
- Fixed an issue that caused the aleph statement db to be erased after a period of inactivity. [PR # 165](https://github.com/mediachain/aleph/165)

## 2016-01-17: aleph-v1.5

mcclient:
- Removed default connection timeouts to concat node API to prevent spurious errors [PR #145](https://github.com/mediachain/aleph/pull/145)
- Added `mcclient net ping` command, which uses libp2p ping protocol, and `mcclient net identify`, which returns
  the output of the libp2p identify protocol.
  Also renamed `mcclient netAddr` and `mcclient netConnections` to `mcclient net addr` and `mcclient net connections`, with
  the old invocations kept around as aliases for compatibility. [PR #154](https://github.com/mediachain/aleph/pull/154)
- Require a prefix for "WKI"s during `mcclient publish`. [PR #156](https://github.com/mediachain/aleph/pull/156)
- Add support for `mcnode` "manifest" commands to set and retrieve the node's public identity manifests. [PR #158](https://github.com/mediachain/aleph/pull/158)

aleph:
- Added local datastore to aleph nodes (currently in-memory only). [PR #144](https://github.com/mediachain/aleph/pull/144)
- Added local statement db to aleph nodes (again, in-memory only). [PR #146](https://github.com/mediachain/aleph/pull/146)
- Added support for pushing statements + data from aleph nodes to concat nodes. [PR #147](https://github.com/mediachain/aleph/pull/147)
- Added support for merging statements + data from concat nodes to aleph nodes. [PR #152](https://github.com/mediachain/aleph/pull/152)


## 2016-12-19: aleph-v1.4

mcclient:

- Support for concat 1.4 directory extensions, with namespace listings [PR #128](https://github.com/mediachain/aleph/pull/128)
    - `mcclient listNamespaces` command to list all public namespaces
    - `mcclient listPeers` command now allows optional `namespace` argument, to list all peers that have published to a given namespace
- Support for getting/setting multiple directory servers [PR #135](https://github.com/mediachain/aleph/pull/135)
- Support for batch data object retrieval API endpoint [PR #123](https://github.com/mediachain/aleph/pull/123)
- Added global `--timeout` flag to override default 15s request timeout [PR #129](https://github.com/mediachain/aleph/pull/129)
- Much faster (~ 1.8x) CBOR conversions thanks to [borc](https://github.com/dignifiedquire/borc) module [PR #131](https://github.com/mediachain/aleph/pull/131)
- Fixed memory leak that could cause `mcclient publish` to fail on very large ingestions [PR #134](https://github.com/mediachain/aleph/pull/134)
- Automatic SSH tunneling no longer conflicts with local `mcnode`, uses random free port for tunnel [PR #136](https://github.com/mediachain/aleph/pull/136)
- Added debug commands to list libp2p connections and known addresses for peers [PR #122](https://github.com/mediachain/aleph/pull/122)

## 2016-12-05: aleph-v1.3

mcclient:
- `mcclient --sshConfig` option for creating SSH tunnel from config file 
  (works with Mediachain Deploy credentials file)
- support for new garbage collection and compation concat APIs
    - `mcclient data gc`, `mcclient data compact`, `mcclient data sync`
- `mcclient data keys` command to list keys for all objects in datastore
- `mcclient lookupPeer` comand to do directory or DHT peer lookup

aleph peer-to-peer:
- use stronger RSA keys (2048 bit) for aleph peer ids 


## 2016-11-25: aleph-v1.2.2

Fixes [an issue](https://github.com/mediachain/aleph/issues/97) that prevented `npm install -g aleph` from succeeding on linux.

## 2016-11-21: aleph-v1.2.1

Adds --jsonld flag to mcclient validate command to structurally validate JSON-LD input objects

## 2016-11-21: aleph-v1.2.0

- support for large metadata objects (up to 1MB) during publication
- better error handling for invalid publication inputs and unreachable peers
- timeouts for peer-to-peer connections and concat API calls
- support for concat-v1.2 authorization and push apis in `mcclient`
- new `aleph` cli command with repl and peer-to-peer query commands
- support fetching data inline with query results in `aleph query` 

## 2016-11-04: aleph-v1.1.1

mcclient changes:
- support for JSONSchema validation of records using "self-describing" schemas
- use jq for preprocessing records before publication and pretty-printing JSON output
- support publishing compound statements to concat
- add `mcclient netAddr` command to show the listen addresses of local concat node
- improve help text and usage output
- add documentation for schema generation with schema-guru, and support for generated schemas
- better error handling for publish command
- updated ingestion scripts for CC datasets

aleph peer-to-peer changes:
- support for fetching remote objects via mediachain peer-to-peer protocol
- fix missing protobuf definitions in babel-compiled build

