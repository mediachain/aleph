#!/bin/bash

NAMESPACE='--namespace foo.bar'  # FIXME: should accept this as an argument, need to update ingest-parallel to pass it in

# Hash of schema that must be published on the node before ingestion.
# You must update this if you change the schema.
SCHEMA_HASH='--schemaReference QmYGRQYmWC3BAtTAi88mFb7GVeFsUKGM4nm25SBUB9vfc9'

SKIP_VALIDATION='--skipSchemaValidation'
# if you want to validate every record, use this one instead:
# SKIP_VALIDATION=''

JQ_FILTER='--jqFilter "._source | del(.aesthetics)"'
ID_FILTER='--idFilter .native_id'

mcclient publish ${SKIP_VALIDATION} ${JQ_FILTER} ${ID_FILTER} ${NAMESPACE} ${SCHEMA_HASH} $1 > /dev/null

