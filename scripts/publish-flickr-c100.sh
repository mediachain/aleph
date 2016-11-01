#!/bin/bash

NAMESPACE="--namespace images.flickr"
#SCHEMA_HASH='--schemaReference QmYGRQYmWC3BAtTAi88mFb7GVeFsUKGM4nm25SBUB9vfc9'
SCHEMA_HASH=''
COMPOUND="--compound 100"

mcclient publish ${COMPOUND} \
    --jqFilter '._source | del(.aesthetics)' \
    --idFilter '.native_id' \
    ${NAMESPACE} \
    ${SCHEMA_HASH} \
    $1 > /dev/null

