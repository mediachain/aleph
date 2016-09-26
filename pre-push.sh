#!/bin/bash

# check for nvm (node version manager) and make sure it's enabled
# helpful if running commmit hook from outside your shell env
# e.g. from a GUI like gitup

if [ -e "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
fi

# stash un-staged changes
NUM_STASHES_BEFORE=$(git stash list | wc -l)
git stash -q --keep-index
NUM_STASHES_AFTER=$(git stash list | wc -l)

# run standard (code style enforcer), flow, and tests
npm run check && npm run test

RESULT=$?

# un-stash, if the previous stash command actually created a stash
if [ "$NUM_STASHES_AFTER" -gt "$NUM_STASHES_BEFORE" ]; then
    git stash pop -q
fi

# abort commit if anything failed
[ $RESULT -ne 0 ] && exit 1

exit 0
