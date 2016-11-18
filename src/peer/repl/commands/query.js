// @flow

const pull = require('pull-stream')
const { bootstrap, binaryToB64 } = require('../util')
const { printJSON } = require('../../../client/cli/util')

module.exports = {
  command: 'query <queryString>',
  builder: {
    color: {
      type: 'boolean',
      description: 'Explicitly enable (or disable, with --no-color) colorized output.\n',
      default: null,
      defaultDescription: 'Print in color if stdout is a tty, and monochrome if piped or pretty-printing is disabled.'
    },
    pretty: {
      type: 'boolean',
      description: 'Pretty print the output.\n',
      default: true,
      defaultDescription: 'True.  Use --no-pretty for compact output.'
    }
  },
  description: 'Query a remote peer using the mediachain peer-to-peer query protocol.\n',
  handler: (opts: {queryString: string, dir?: string, remotePeer?: string, identityPath: string, pretty: boolean, color?: boolean}) => {
    const {queryString, remotePeer, pretty, color} = opts
    if (remotePeer == null) {
      // TODO: better message
      console.error('remotePeer is required.')
      process.exit(1)
    }

    let node, remote
    bootstrap(opts).then(nodes => {
        node = nodes.node
        remote = nodes.remote
        return node.start()
      })
      .then(() => {
        if (remote == null) {
          throw new Error('Remote peer is unavailable')
        }

        return node.remoteQueryStream(remote.remotePeerInfo, queryString)
          .then(stream => printResultStream(stream, color, pretty))
      })
      .then(() => { process.exit(0) })
      .catch(err => {
        console.error(err.message)
        process.exit(1)
      })
  }
}

function printResultStream (queryStream: Function, color: ?boolean, pretty: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    pull(
      queryStream,
      pull.through(result => {
        printJSON(binaryToB64(result), {color, pretty})
      }),
      pull.onEnd((err) => {
        if (err) return reject(err)
        resolve()
      })
    )
  })
}

