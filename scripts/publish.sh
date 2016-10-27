#!/bin/bash

NAMESPACE='foo.bar'  # FIXME: should accept this as an argument, need to update ingest-parallel to pass it in

# Hash of schema that must be published on the node before ingestion.
# You must update this if you change the schema.
SCHEMA_HASH='QmYGRQYmWC3BAtTAi88mFb7GVeFsUKGM4nm25SBUB9vfc9'

SKIP_VALIDATION='--skipSchemaValidation'
# if you want to validate every record, use this one instead:
# SKIP_VALIDATION=''

CONTENT_SELECTOR='--contentSelector _source'
ID_SELECTOR='--idSelector native_id'
CONTENT_FILTERS='--contentFilters aesthetics'

mcclient publish ${SKIP_VALIDATION} ${CONTENT_SELECTOR} ${ID_SELECTOR} ${CONTENT_FILTERS} ${NAMESPACE} ${SCHEMA_HASH} $1 > /dev/null

