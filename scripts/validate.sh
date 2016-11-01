#!/bin/bash

REPO_ROOT=$(git rev-parse --show-toplevel)
SCHEMA_FILE="${REPO_ROOT}/scripts/io.mediachain.indexer_image_jsonschema_1-0-0.json"

mcclient validate \
 --jqFilter '._source | del(.aesthetics)' \
 ${SCHEMA_FILE} $1

