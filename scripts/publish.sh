#!/bin/bash

NAMESPACE='foo.bar'
CONTENT_SELECTOR='_source'
ID_SELECTOR='native_id'

mcclient publish --contentSelector $CONTENT_SELECTOR $NAMESPACE $ID_SELECTOR $1 > /dev/null

