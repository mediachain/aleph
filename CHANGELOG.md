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

