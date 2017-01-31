// @flow

const { Statement, statementBodyFromProtobuf } = require('./statement')
import type { StatementBody } from './statement'
import type { QueryResultValueMsg, SimpleValueMsg } from '../protobuf/types'

export type QueryResultValue = number | string | Statement | StatementBody

function unpackQueryResultProtobuf (msg: QueryResultValueMsg): QueryResultValue {
  if (msg.simple == null) {
    throw new Error('Only simple query result values are currently supported')
  }
  const val: SimpleValueMsg = (msg.simple: any)
  if (val.stringValue != null) return (val.stringValue: any)
  if (val.intValue != null) return (val.intValue: any)
  if (val.stmt != null) return Statement.fromProtobuf((val.stmt: any))
  if (val.stmtBody != null) return statementBodyFromProtobuf((val.stmtBody: any))

  throw new Error('Unexpected query result value: ' + JSON.stringify(val))
}

module.exports = {
  unpackQueryResultProtobuf
}
