// @flow

const { PublisherId, PublicSigningKey } = require('../peer/identity')
const pb = require('../protobuf')
const serialize = require('../metadata/serialize')
const { b58MultihashForBuffer, stringifyNestedBuffers, setUnion } = require('../common/util')

import type { StatementMsg, StatementBodyMsg, SimpleStatementMsg, CompoundStatementMsg, EnvelopeStatementMsg } from '../protobuf/types'

class Statement {
  id: string
  publisher: string
  namespace: string
  timestamp: number
  body: StatementBody

  static fromProtobuf (msg: StatementMsg): Statement {
    const body = StatementBody.fromProtobuf(msg.body)

    const {id, publisher, namespace, timestamp, signature} = msg
    if (signature == null) {
      return new UnsignedStatement({id, publisher, namespace, timestamp, body})
    }

    return new SignedStatement({id, publisher, namespace, timestamp, body, signature})
  }

  static fromBytes (bytes: Buffer): Statement {
    return Statement.fromProtobuf(pb.stmt.Statement.decode(bytes))
  }

  toProtobuf (): StatementMsg {
    const {id, publisher, namespace, timestamp, body} = this
    const msg: StatementMsg = {id, publisher, namespace, timestamp: timestamp, body: body.toProtobuf()}
    if (this instanceof SignedStatement) {
      msg.signature = this.signature
    }
    return msg
  }

  toBytes (): Buffer {
    return pb.stmt.Statement.encode(this.toProtobuf())
  }

  toJSON (): Object {
    return stringifyNestedBuffers(this.toProtobuf())
  }

  inspect () {
    const {id, publisher, namespace, timestamp, body} = this
    const output: Object = {id, publisher, namespace, timestamp, body: body.inspect()}
    if (this instanceof SignedStatement) {
      output.signature = this.signature
    }
    return stringifyNestedBuffers(output)
  }

  get objectIds (): Array<string> {
    return this.body.objectIds
  }

  get refSet (): Set<string> {
    return this.body.refSet
  }

  get depsSet (): Set<string> {
    return this.body.depsSet
  }

  get source (): string {
    if (!(this.body instanceof EnvelopeStatementBody)) {
      return this.publisher
    }

    if (this.body.statements.length < 1) {
      return this.publisher
    }

    return this.body.statements[0].source
  }

  expandObjects (source: Map<string, Object>): Statement {
    const body = this.body.expandObjects(source)
    const {id, publisher, namespace, timestamp} = this
    if (this instanceof SignedStatement) {
      return new SignedStatement({ id, publisher, namespace, timestamp, body, signature: this.signature })
    }
    return new UnsignedStatement({ id, publisher, namespace, timestamp, body })
  }

  asUnsignedStatement (): UnsignedStatement {
    const {id, namespace, publisher, timestamp, body} = this
    return new UnsignedStatement({id, namespace, publisher, timestamp, body})
  }
}

class UnsignedStatement extends Statement {
  constructor (stmt: {id: string, publisher: string, namespace: string, timestamp: number, body: StatementBody}) {
    super()
    this.id = stmt.id
    this.publisher = stmt.publisher
    this.namespace = stmt.namespace
    this.timestamp = stmt.timestamp
    this.body = stmt.body
  }

  sign (publisherId: PublisherId): Promise<SignedStatement> {
    return Promise.resolve().then(() => {
      if (publisherId.id58 !== this.publisher) {
        throw new Error(`Cannot sign statement, publisher id of signer does not match statement publisher`)
      }

      return this.calculateSignature(publisherId)
        .then(signature => {
          const {id, namespace, publisher, timestamp, body} = this
          return new SignedStatement({id, namespace, publisher, timestamp, body, signature})
        })
    })
  }

  calculateSignature (signer: {+sign: (msg: Buffer) => Promise<Buffer>}): Promise<Buffer> {
    return signer.sign(this.toBytes())
  }
}

class SignedStatement extends Statement {
  signature: Buffer

  constructor (stmt: {id: string, publisher: string, namespace: string, timestamp: number, body: StatementBody, signature: Buffer | string}) {
    super()
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

  static create (
    publisherId: PublisherId,
    namespace: string,
    statementBody: StatementBody | StatementBodyMsg,
    counter: number = 0,
    timestampGenerator: () => number = Date.now)
  : Promise<SignedStatement> {
    const body = (statementBody instanceof StatementBody) ? statementBody : StatementBody.fromProtobuf(statementBody)
    const timestamp = timestampGenerator()
    const statementId = [publisherId.id58, timestamp.toString(), counter.toString()].join(':')
    const stmt = new UnsignedStatement({
      id: statementId,
      publisher: publisherId.id58,
      namespace,
      timestamp,
      body
    })
    return stmt.sign(publisherId)
  }

  static createSimple (
    publisherId: PublisherId,
    namespace: string,
    statementBody: {object: string | Object, refs?: Array<string>, deps?: Array<string>, tags?: Array<string>},
    counter: number = 0,
    timestampGenerator: () => number = Date.now
  ): Promise<SignedStatement> {
    let body
    if (typeof statementBody.object === 'object') {
      body = new ExpandedSimpleStatementBody((statementBody: any))
    } else {
      body = new SimpleStatementBody((statementBody: any))
    }
    return SignedStatement.create(publisherId, namespace, body, counter, timestampGenerator)
  }

  static fromProtobuf (msg: StatementMsg): SignedStatement {
    const body = StatementBody.fromProtobuf(msg.body)

    const {id, publisher, namespace, timestamp, signature} = msg
    if (signature == null) {
      throw new Error(
        'SignedStatement.fromProtobuf() requires a non-null signature. ' +
        'Use Statement.fromProtobuf() or UnsignedStatement.fromProtobuf() if your message is unsigned.'
      )
    }
    return new SignedStatement({id, publisher, namespace, timestamp, body, signature})
  }

  verifySignature (publicKey?: ?PublicSigningKey, keyCache?: Map<string, PublicSigningKey>): Promise<boolean> {
    return Promise.resolve()
      .then(() => {
        keyCache = keyCache || new Map()
        publicKey = publicKey || keyCache.get(this.publisher) || PublicSigningKey.fromB58String(this.publisher)
        keyCache.set(this.publisher, publicKey)

        const msg: Object = this.toProtobuf()
        msg.signature = null
        const bytes = pb.stmt.Statement.encode(msg)
        return publicKey.verify(bytes, this.signature)
      })
  }
}

class StatementBody {
  constructor () {
    if (this.constructor === StatementBody) {
      throw new Error("StatementBody class is abstract, don't instantiate directly")
    }
  }

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

  toProtobuf (): StatementBodyMsg {
    throw new Error('StatementBody.toProtobuf() is not implemented - subclasses must implement')
  }

  expandObjects (source: Map<string, Object>): StatementBody {
    return this
  }

  inspect (): Object | Array<Object> {
    return {}
  }

  get refSet (): Set<string> {
    return new Set()
  }

  get depsSet (): Set<string> {
    return new Set()
  }

  get objectIds (): Array<string> {
    return []
  }
}

class SimpleStatementBody extends StatementBody {
  objectRef: string
  refs: Array<string>
  deps: Array<string>
  tags: Array<string>

  constructor (contents: {object: string, refs?: Array<string>, deps?: Array<string>, tags?: Array<string>}) {
    super()
    this.objectRef = contents.object
    this.refs = contents.refs || []
    this.deps = contents.deps || []
    this.tags = contents.tags || []
  }

  static fromProtobuf (msg: SimpleStatementMsg): SimpleStatementBody {
    return new SimpleStatementBody(msg)
  }

  toProtobuf (): StatementBodyMsg {
    return {simple: this.toSimpleProtobuf()}
  }

  toSimpleProtobuf (): SimpleStatementMsg {
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

  get refSet (): Set<string> {
    return new Set(this.refs)
  }

  get depsSet (): Set<string> {
    return new Set(this.deps)
  }

  inspect (): Object {
    return this.toSimpleProtobuf()
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

  toProtobuf (): StatementBodyMsg {
    return {
      compound: {
        body: this.simpleBodies.map(b => b.toSimpleProtobuf())
      }
    }
  }

  expandObjects (source: Map<string, Object>): StatementBody {
    const expanded = this.simpleBodies.map(b => (b.expandObjects(source): any))
    return new CompoundStatementBody(expanded)
  }

  inspect (): Array<Object> {
    return this.simpleBodies.map(b => b.inspect())
  }

  get objectIds (): Array<string> {
    return [].concat(...this.simpleBodies.map(b => b.objectIds))
  }

  get refSet (): Set<string> {
    return setUnion(...this.simpleBodies.map(b => b.refSet))
  }

  get depsSet (): Set<string> {
    return setUnion(...this.simpleBodies.map(b => b.depsSet))
  }
}

class EnvelopeStatementBody extends StatementBody {
  statements: Array<Statement>

  constructor (statements: Array<Statement>) {
    super()
    this.statements = statements
  }

  static fromProtobuf (msg: EnvelopeStatementMsg): EnvelopeStatementBody {
    return new EnvelopeStatementBody(msg.body.map(stmt => SignedStatement.fromProtobuf(stmt)))
  }

  toProtobuf (): StatementBodyMsg {
    return {
      envelope: {
        body: this.statements.map(stmt => stmt.toProtobuf())
      }
    }
  }

  expandObjects (source: Map<string, Object>): StatementBody {
    const expanded = this.statements.map(stmt => stmt.expandObjects(source))
    return new EnvelopeStatementBody(expanded)
  }

  inspect (): Array<Object> {
    return this.statements.map(s => s.inspect())
  }

  get objectIds (): Array<string> {
    return [].concat(...this.statements.map(stmt => stmt.objectIds))
  }

  get refSet (): Set<string> {
    return setUnion(...this.statements.map(stmt => stmt.refSet))
  }

  get depsSet (): Set<string> {
    return setUnion(...this.statements.map(stmt => stmt.depsSet))
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
    const {object, refs, deps, tags} = this
    return {object, refs, deps, tags}
  }

  inspect (): Object {
    return this.toJSON()
  }
}

module.exports = {
  Statement,
  UnsignedStatement,
  SignedStatement,
  StatementBody,
  SimpleStatementBody,
  CompoundStatementBody,
  EnvelopeStatementBody,
  ExpandedSimpleStatementBody
}
