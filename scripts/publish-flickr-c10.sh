#!/bin/bash

NAMESPACE="images.flickr"
SCHEMA_HASH='QmYGRQYmWC3BAtTAi88mFb7GVeFsUKGM4nm25SBUB9vfc9'
COMPOUND="--compound 10"

mcclient publish ${COMPOUND} \
    --skipSchemaValidation \
    --jqFilter '._source | del(.aesthetics)' \
    --idFilter '.native_id' \
    ${NAMESPACE} \
    ${SCHEMA_HASH} \
    $1 > /dev/null

