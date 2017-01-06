// @flow

const { signStatement } = require('./signatures')
import type { PublisherId } from '../peer/identity'
import type { StatementMsg, StatementBodyMsg } from '../protobuf/types'

function makeStatement (
  publisherId: PublisherId,
  namespace: string,
  statementBody: StatementBodyMsg,
  counter: number = 0,
  timestampGenerator: () => number = Date.now
): Promise<StatementMsg> {
  const timestamp = timestampGenerator()
  const statementId = [publisherId.id58, timestamp.toString(), counter.toString()].join(':')
  const stmt = {
    id: statementId,
    publisher: publisherId.id58,
    namespace,
    timestamp,
    body: statementBody,
    signature: Buffer.from('')
  }
  return signStatement(stmt, publisherId)
}

function makeSimpleStatement (
  publisherId: PublisherId,
  namespace: string,
  contents: {
    object: string,
    refs: Array<string>,
    deps?: Array<string>,
    tags?: Array<string>
  },
  counter: number = 0,
  timestampGenerator: () => number = Date.now
): Promise<StatementMsg> {
  const {object, refs, deps, tags} = Object.assign({object: '', refs: [], deps: [], tags: []}, contents)
  const body = {object, refs, deps, tags}
  return makeStatement(publisherId, namespace, {simple: body}, counter, timestampGenerator)
}

module.exports = {
  makeStatement,
  makeSimpleStatement
}
