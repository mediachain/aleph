#!/bin/bash

NAMESPACE="images.pexels"
# Hash of schema that must be published on the node before ingestion.
# You must update this if you change the schema.
SCHEMA_HASH='QmYGRQYmWC3BAtTAi88mFb7GVeFsUKGM4nm25SBUB9vfc9'

SKIP_VALIDATION='--skipSchemaValidation'
# if you want to validate every record, use this one instead:
# SKIP_VALIDATION=''

mcclient publish ${SKIP_VALIDATION} \
    --jqFilter '._source | del(.aesthetics)' \
    --idFilter '.native_id' \
    ${NAMESPACE} \
    ${SCHEMA_HASH} \
    $1 > /dev/null

