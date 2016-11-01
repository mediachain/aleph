#!/bin/bash

NAMESPACE="images.flickr"
CONTENT_SELECTOR="--contentSelector _source"
CONTENT_FILTERS="--contentFilters aesthetics"
ID_SELECTOR="--idSelector native_id"
COMPOUND="--compound 100"

mcclient publish ${COMPOUND} ${CONTENT_SELECTOR} ${ID_SELECTOR} ${CONTENT_FILTERS} ${NAMESPACE} $1 > /dev/null

