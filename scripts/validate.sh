#!/bin/bash

REPO_ROOT=$(git rev-parse --show-toplevel)
SCHEMA_FILE="${REPO_ROOT}/scripts/io.mediachain.indexer-image-jsonschema-1-0-0.json"

mcclient validate \
 --jqFilter '._source | del(.aesthetics)' \
 ${SCHEMA_FILE} $1

