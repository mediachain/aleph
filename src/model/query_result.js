// @flow

const { Statement, StatementBody } = require('./statement')
import type { QueryResultMsg, QueryResultValueMsg, SimpleValueMsg, CompoundValueMsg } from '../protobuf/types'

export type QueryResult = QueryResultValue | Error
export type QueryResultValue = SimpleQueryResultValue | CompoundQueryResultValue
export type SimpleQueryResultValue = number | string | Statement | StatementBody
export type CompoundQueryResultValue = Array<{key: string, value: SimpleQueryResultValue}>

function unpackQueryResultProtobuf (msg: QueryResultMsg): QueryResult {
  if (msg.error != null) {
    const errorMsg = msg.error.error || 'Unknown error'
    return new Error(errorMsg)
  }
  if (msg.value != null) {
    return unpackQueryResultValueProtobuf((msg.value: any))
  }
  throw new Error('Unexpected query result: ' + JSON.stringify(msg))
}

function unpackQueryResultValueProtobuf (msg: QueryResultValueMsg): QueryResultValue {
  if (msg.simple != null) {
    return unpackSimpleValue((msg.simple: any))
  }
  if (msg.compound != null) {
    const compound: CompoundValueMsg = (msg.compound: any)
    return compound.body.map(kvPair => ({
      key: kvPair.key,
      value: unpackSimpleValue(kvPair.value)
    }))
  }
  throw new Error('Unexpected Query result value ' + JSON.stringify(msg))
}

function unpackSimpleValue (val: SimpleValueMsg): SimpleQueryResultValue {
  if (val.stringValue != null) return (val.stringValue: any)
  if (val.intValue != null) return (val.intValue: any)
  if (val.stmt != null) return Statement.fromProtobuf((val.stmt: any))
  if (val.stmtBody != null) return StatementBody.fromProtobuf((val.stmtBody: any))

  throw new Error('Unexpected query result value: ' + JSON.stringify(val))
}

module.exports = {
  unpackQueryResultProtobuf,
  unpackQueryResultValueProtobuf
}
