// @flow

const { inspect } = require('util')
const pb = require('../protobuf')
import type { StatementMsg, StatementBodyMsg, SimpleStatementMsg, CompoundStatementMsg, EnvelopeStatementMsg } from '../protobuf/types'

export type StatementBody = SimpleStatementBody | CompoundStatementBody | EnvelopeStatementBody

class Statement {
  id: string
  publisher: string
  namespace: string
  timestamp: number
  body: StatementBody
  signature: Buffer

  constructor (stmt: {id: string, publisher: string, namespace: string, timestamp: number, body: StatementBody, signature: Buffer}) {
    this.id = stmt.id
    this.publisher = stmt.publisher
    this.namespace = stmt.namespace
    this.timestamp = stmt.timestamp
    this.body = stmt.body
    this.signature = stmt.signature
  }

  static fromProtobuf (msg: StatementMsg): Statement {
    const body = statementBodyFromProtobuf(msg.body)

    const {id, publisher, namespace, timestamp, signature} = msg
    return new Statement({id, publisher, namespace, timestamp, body, signature})
  }

  static fromBytes (msgBuffer: Buffer): Statement {
    return Statement.fromProtobuf(pb.stmt.Statement.decode(msgBuffer))
  }

  toProtobuf (): StatementMsg {
    const {id, publisher, namespace, timestamp, signature, body} = this
    let wrappedBody
    if (body instanceof SimpleStatementBody) {
      wrappedBody = {simple: body.toProtobuf()}
    } else if (body instanceof CompoundStatementBody) {
      wrappedBody = {compound: body.toProtobuf()}
    } else if (body instanceof EnvelopeStatementBody) {
      wrappedBody = {envelope: body.toProtobuf()}
    } else {
      throw new Error('Unknown type for statement body: ' + body.constructor.toString())
    }

    return {id, publisher, namespace, timestamp: timestamp, signature, body: wrappedBody}
  }

  toBytes (): Buffer {
    return pb.stmt.Statement.encode(this.toProtobuf())
  }

  toJSON (): Object {
    const obj: Object = this.toProtobuf()
    obj.signature = obj.signature.toString('base64')
    return obj
  }

  inspect (_depth: number, opts: Object) {
    return inspect(this.toJSON(), Object.assign({}, opts, {depth: 100}))
  }
}

class SimpleStatementBody {
  object: string
  refs: Array<string>
  deps: Array<string>
  tags: Array<string>

  constructor (contents: {object: string, refs?: Array<string>, deps?: Array<string>, tags?: Array<string>}) {
    this.object = contents.object
    this.refs = contents.refs || []
    this.deps = contents.deps || []
    this.tags = contents.tags || []
  }

  static fromProtobuf (msg: SimpleStatementMsg): SimpleStatementBody {
    return new SimpleStatementBody(msg)
  }

  toProtobuf (): SimpleStatementMsg {
    const {object, refs, deps, tags} = this
    return {object, refs, deps, tags}
  }

  inspect (_depth: number, opts: Object) {
    return inspect(this.toProtobuf(), opts)
  }
}

class CompoundStatementBody {
  simpleBodies: Array<SimpleStatementBody>

  constructor (simpleBodies: Array<SimpleStatementBody>) {
    this.simpleBodies = simpleBodies
  }

  static fromProtobuf (msg: CompoundStatementMsg): CompoundStatementBody {
    return new CompoundStatementBody(
      msg.body.map(b => SimpleStatementBody.fromProtobuf(b))
    )
  }

  toProtobuf (): CompoundStatementMsg {
    return {
      body: this.simpleBodies.map(b => b.toProtobuf())
    }
  }

  inspect (_depth: number, opts: Object) {
    return inspect(this.simpleBodies, opts)
  }
}

class EnvelopeStatementBody {
  statements: Array<Statement>

  constructor (statements: Array<Statement>) {
    this.statements = statements
  }

  static fromProtobuf (msg: EnvelopeStatementMsg): EnvelopeStatementBody {
    return new EnvelopeStatementBody(msg.body.map(stmt => Statement.fromProtobuf(stmt)))
  }

  toProtobuf (): EnvelopeStatementMsg {
    return {
      body: this.statements.map(stmt => stmt.toProtobuf())
    }
  }

  inspect (_depth: number, opts: Object) {
    return inspect(this.statements, opts)
  }
}

function statementBodyFromProtobuf (msg: StatementBodyMsg): StatementBody {
  if (msg.simple != null) {
    return SimpleStatementBody.fromProtobuf((msg.simple: any))
  } else if (msg.compound != null) {
    return CompoundStatementBody.fromProtobuf((msg.compound: any))
  } else if (msg.envelope != null) {
    return EnvelopeStatementBody.fromProtobuf((msg.envelope: any))
  }

  throw new Error('Unsupported statement body ' + JSON.stringify(msg))
}

module.exports = {
  Statement,
  SimpleStatementBody,
  CompoundStatementBody,
  EnvelopeStatementBody,
  statementBodyFromProtobuf
}
