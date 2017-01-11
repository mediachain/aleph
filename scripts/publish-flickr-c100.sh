#!/bin/bash

NAMESPACE="--namespace images.flickr"
SCHEMA_HASH='--schemaReference QmYGRQYmWC3BAtTAi88mFb7GVeFsUKGM4nm25SBUB9vfc9'
COMPOUND="--compound 100"

mcclient publish ${COMPOUND} \
    --skipSchemaValidation \
    --jqFilter '._source | del(.aesthetics)' \
    --idFilter '.native_id | sub("flickr[^_]*_(?<id>\\d+)"; "\(.id)")' \
    --prefix 'flickr'
    ${NAMESPACE} \
    ${SCHEMA_HASH} \
    $1 > /dev/null

