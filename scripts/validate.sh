#!/bin/bash

REPO_ROOT=$(git rev-parse --show-toplevel)
SCHEMA_FILE="${REPO_ROOT}/scripts/io.mediachain.indexer_image_jsonschema_1-0-0.json"
CONTENT_SELECTOR='--contentSelector _source'
CONTENT_FILTERS='--contentFilters aesthetics'

mcclient validate ${CONTENT_SELECTOR} ${CONTENT_FILTERS} ${SCHEMA_FILE} $1

