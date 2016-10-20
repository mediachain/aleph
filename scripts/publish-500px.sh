#!/bin/bash

NAMESPACE="images.500px"
CONTENT_SELECTOR="--contentSelector _source"
CONTENT_FILTERS="--contentFilters aesthetics"
ID_SELECTOR="--idSelector native_id"

mcclient publish ${CONTENT_SELECTOR} ${ID_SELECTOR} ${CONTENT_FILTERS} ${NAMESPACE} $1 > /dev/null

