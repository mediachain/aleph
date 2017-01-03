#!/bin/bash

# check for nvm (node version manager) and make sure it's enabled
# helpful if running commmit hook from outside your shell env
# e.g. from a GUI like gitup

if [ -e "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
fi

# stash un-staged changes
STASH_REF_BEFORE=$(git rev-parse --verify -q refs/stash 2>/dev/null)
git stash -q --keep-index
STASH_REF_AFTER=$(git rev-parse --verify -q refs/stash 2>/dev/null)

# run standard (code style enforcer), flow, and tests
npm run check && npm run test && npm shrinkwrap

RESULT=$?

# un-stash, if the previous stash command actually created a stash
if [ "$STASH_REF_BEFORE" != "$STASH_REF_AFTER" ]; then
    git stash pop -q
fi

# abort commit if anything failed
[ $RESULT -ne 0 ] && exit 1

exit 0
