// @flow

const { inspect } = require('util')
const pb = require('../protobuf')
const serialize = require('../metadata/serialize')
const { b58MultihashForBuffer, stringifyNestedBuffers } = require('../common/util')

import type { StatementMsg, StatementBodyMsg, SimpleStatementMsg, CompoundStatementMsg, EnvelopeStatementMsg } from '../protobuf/types'

class Statement {
  id: string
  publisher: string
  namespace: string
  timestamp: number
  body: StatementBody
  signature: Buffer

  constructor (stmt: {id: string, publisher: string, namespace: string, timestamp: number, body: StatementBody, signature: Buffer | string}) {
    this.id = stmt.id
    this.publisher = stmt.publisher
    this.namespace = stmt.namespace
    this.timestamp = stmt.timestamp
    this.body = stmt.body
    if (Buffer.isBuffer(stmt.signature)) {
      this.signature = (stmt.signature: any)
    } else {
      this.signature = Buffer.from(stmt.signature, 'base64')
    }
  }

  static fromProtobuf (msg: StatementMsg): Statement {
    const body = StatementBody.fromProtobuf(msg.body)

    const {id, publisher, namespace, timestamp, signature} = msg
    return new Statement({id, publisher, namespace, timestamp, body, signature})
  }

  static fromBytes (msgBuffer: Buffer): Statement {
    return Statement.fromProtobuf(pb.stmt.Statement.decode(msgBuffer))
  }

  toProtobuf (): StatementMsg {
    const {id, publisher, namespace, timestamp, signature, body} = this
    let wrappedBody: StatementBodyMsg
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
    return stringifyNestedBuffers(this.toProtobuf())
  }

  inspect (_depth: number, opts: Object) {
    opts.depth = null
    const {id, publisher, namespace, timestamp, signature, body} = this
    const output = stringifyNestedBuffers({id, publisher, namespace, timestamp, signature, body})
    return inspect(output, opts)
  }

  get objectIds (): Array<string> {
    return this.body.objectIds
  }

  get refs (): Array<string> {
    return this.body.refs
  }

  expandObjects (source: Map<string, Object>): Statement {
    const body = this.body.expandObjects(source)
    const {id, publisher, namespace, timestamp, signature} = this
    return new Statement({id, publisher, namespace, timestamp, body, signature})
  }
}

class StatementBody {
  static fromProtobuf (msg: Object): StatementBody {
    if (msg.simple != null) {
      return SimpleStatementBody.fromProtobuf((msg.simple: any))
    } else if (msg.compound != null) {
      return CompoundStatementBody.fromProtobuf((msg.compound: any))
    } else if (msg.envelope != null) {
      return EnvelopeStatementBody.fromProtobuf((msg.envelope: any))
    }

    throw new Error('Unsupported statement body ' + JSON.stringify(msg))
  }

  expandObjects (source: Map<string, Object>): StatementBody {
    return this
  }

  get refs (): Array<string> {
    return []
  }

  get objectIds (): Array<string> {
    return []
  }
}

class SimpleStatementBody extends StatementBody {
  objectRef: string
  _refs: Array<string>
  deps: Array<string>
  tags: Array<string>

  constructor (contents: {object: string, refs?: Array<string>, deps?: Array<string>, tags?: Array<string>}) {
    super()
    this.objectRef = contents.object
    this._refs = contents.refs || []
    this.deps = contents.deps || []
    this.tags = contents.tags || []
  }

  static fromProtobuf (msg: SimpleStatementMsg): SimpleStatementBody {
    return new SimpleStatementBody(msg)
  }

  toProtobuf (): SimpleStatementMsg {
    const {objectRef, refs, deps, tags} = this
    return {object: objectRef, refs, deps, tags}
  }

  expandObjects (source: Map<string, Object>): StatementBody {
    const object = source.get(this.objectRef)
    if (object == null) {
      // FIXME: should we just return the un-expanded body instead?
      throw new Error(`No object matching ref ${this.objectRef} available, cannot expand`)
    }

    return new ExpandedSimpleStatementBody({object, refs: this.refs, deps: this.deps, tags: this.tags})
  }

  get objectIds (): Array<string> {
    return [this.objectRef]
  }

  get refs (): Array<string> {
    return this._refs
  }

  inspect (_depth: number, _opts: Object) {
    return this.toProtobuf()
  }
}

class CompoundStatementBody extends StatementBody {
  simpleBodies: Array<SimpleStatementBody>

  constructor (simpleBodies: Array<SimpleStatementBody>) {
    super()
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

  expandObjects (source: Map<string, Object>): StatementBody {
    const expanded = this.simpleBodies.map(b => (b.expandObjects(source): any))
    return new CompoundStatementBody(expanded)
  }

  inspect (_depth: number, _opts: Object) {
    return this.simpleBodies
  }

  get objectIds (): Array<string> {
    return [].concat(...this.simpleBodies.map(b => b.objectIds))
  }

  get refs (): Array<string> {
    return [].concat(...this.simpleBodies.map(b => b.refs))
  }
}

class EnvelopeStatementBody extends StatementBody {
  statements: Array<Statement>

  constructor (statements: Array<Statement>) {
    super()
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

  expandObjects (source: Map<string, Object>): StatementBody {
    const expanded = this.statements.map(stmt => stmt.expandObjects(source))
    return new EnvelopeStatementBody(expanded)
  }

  inspect () {
    return this.statements
  }

  get objectIds (): Array<string> {
    return [].concat(...this.statements.map(stmt => stmt.objectIds))
  }

  get refs (): Array<string> {
    return [].concat(...this.statements.map(stmt => stmt.refs))
  }
}


// Expanded statement bodies include the data that a SimpleStatementBody's `object` hash links to
class ExpandedSimpleStatementBody extends SimpleStatementBody {
  object: Object

  constructor (contents: {object: Object, refs?: Array<string>, deps?: Array<string>, tags?: Array<string>}) {
    const object = contents.object
    const bytes = serialize.encode(object)
    const ref = b58MultihashForBuffer(bytes)
    super({object: ref, refs: contents.refs, deps: contents.deps, tags: contents.tags})
    this.object = object
  }

  toJSON (): Object {
    return Object.assign({}, this.toProtobuf(), {object: this.object})
  }

  inspect (_depth: number, opts: Object) {
    opts.depth = null
    return inspect(this.toJSON(), opts)
  }
}

module.exports = {
  Statement,
  StatementBody,
  SimpleStatementBody,
  CompoundStatementBody,
  EnvelopeStatementBody
}
