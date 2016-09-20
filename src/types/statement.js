// @flow

export type SimpleStatement = {
  object: string,
  refs?: Array<string>,
  tags?: Array<string>,
};

export type CompoundStatement = {
  body: Array<SimpleStatement>
};

export type Statement = {
  id?: string,
  publisher?: string,
  namespace?: string,
  body: SimpleStatement | CompoundStatement,
};
