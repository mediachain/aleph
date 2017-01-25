// @flow

const { signStatement } = require('./signatures')
const { setUnion } = require('../common/util')
import type { PublisherId } from '../peer/identity'
import type { StatementMsg, StatementBodyMsg, SimpleStatementMsg, EnvelopeStatementMsg, CompoundStatementMsg } from '../protobuf/types'


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

function statementSource (stmt: StatementMsg): string {
  if (stmt.body.envelope !== undefined) {
    const envelopeStatement: EnvelopeStatementMsg = (stmt.body.envelope: any)  // stupid flow typecast
    if (envelopeStatement.body.length > 0) {
      return statementSource(envelopeStatement.body[0])
    }
  }
  return stmt.publisher
}

function statementRefs (stmt: StatementMsg): Set<string> {
  if (stmt.body.simple !== undefined) {
    return simpleStmtRefs((stmt.body.simple: any))
  }
  if (stmt.body.compound !== undefined) {
    return compoundStmtRefs((stmt.body.compound: any))
  }
  if (stmt.body.envelope !== undefined) {
    return envelopeStmtRefs((stmt.body.envelope: any))
  }
  throw new Error('Invalid statement type (expected simple, compound, or envelope)')
}

function simpleStmtRefs (stmt: SimpleStatementMsg): Set<string> {
  return new Set(stmt.refs)
}

function compoundStmtRefs (stmt: CompoundStatementMsg): Set<string> {
  let allRefs: Set<string> = new Set()
  for (const simpleStmt of stmt.body) {
    allRefs = setUnion(allRefs, simpleStmtRefs(simpleStmt))
  }
  return allRefs
}

function envelopeStmtRefs (stmt: EnvelopeStatementMsg): Set<string> {
  let allRefs: Set<string> = new Set()
  for (const innerStmt of stmt.body) {
    allRefs = setUnion(allRefs, statementRefs(innerStmt))
  }
  return allRefs
}

module.exports = {
  makeStatement,
  makeSimpleStatement,
  statementSource,
  statementRefs
}
