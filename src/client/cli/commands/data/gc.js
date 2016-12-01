// @flow

import type {RestClient} from '../../../api'
const {subcommand, pluralizeCount} = require('../../util')

module.exports = {
  command: 'gc',
  description: 'Trigger garbage collection to remove orphan data objects that are not referenced by any statement.\n',
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts
    return client.garbageCollectDatastore()
      .then(count => {
        console.log(`Garbage collected ${pluralizeCount(count, 'object')}`)
      })
  })
}
