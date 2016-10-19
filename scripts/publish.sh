#!/bin/bash

NAMESPACE='foo.bar'  # FIXME: should accept this as an argument, need to update ingest-parallel to pass it in

CONTENT_SELECTOR='--contentSelector _source'
ID_SELECTOR='--idSelector native_id'
CONTENT_FILTERS='--contentFilters aesthetics'

mcclient publish ${CONTENT_SELECTOR} ${ID_SELECTOR} ${CONTENT_FILTERS} ${NAMESPACE} $1 > /dev/null

