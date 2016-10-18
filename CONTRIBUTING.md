## Contributing Guidelines

### 
If things aren't working, please [file an issue](https://github.com/mediachain/aleph/issues), or reach out to
us on our Slack community: http://slack.mediachain.io

To set up a development environment, make sure you have node 6 installed. [nvm](https://github.com/creationix/nvm)
may be helpful if you need to manage multiple node versions, or if your platform includes an ancient system version.

You'll likely also want to install [flow](https://flowtype.org), either from the
[latest release](https://github.com/facebook/flow/releases/latest), or, if you're on a Mac, with
[homebrew](https://brew.sh): `brew install flow`.  It's possible to build the project without flow,
but flow types are used pervasively throughout, and you might as well get the benefit of the analyzer :)

Once that's set up, `npm run build` will run the `src` directory through babel and output compiled code to the `lib`
directory.  At the moment babel is only used for removing flow type annotations from the compiled output, although
we may lean on it more as we target other execution environments (e.g., the browser).

If you're working on the `mcclient` code, you might want to use `npm run cli -- # args for mcclient go after double dashes`, which will
compile the code before running the command.  Otherwise you need to remember to run `npm run build` before `mcclient`
to compile your changes.

### Style

Aleph is written in the [subset of ES2016 supported by node 6](http://node.green), with [flow type annotations](https://flowtype.org).
Code is formatted according to [standard.js rules](http://standardjs.com/), with plugins to make standard.js play
nice with flow.  The upshot is that you can use most fancy "next-gen" JS features, with the exception of
`async`/`await` and the "object spread" syntax (e.g. `const fooWithBar = {...foo, bar: 'baz'}`).  If you find
yourself needing the latter, you can use the "desugared" `const fooWithBar = Object.assign({}, foo, {bar: 'baz'})`.


### Tests
Running `npm run check` will run both standard and flow, and it's good to get into the habit of running it
periodically to catch any type errors, etc.  If you want, you can force the habit upon yourself by using the
`pre-push.sh` git hook, which can be installed with `cd .git/hooks && ln -s ../../pre-push.sh pre-push`.  The
pre-push hook will also run the unit tests with `npm run test` to try to catch any regressions.

That said, please don't let type checkers or style guides discourage you from contributing!  If you'd rather not
mess about with pleasing our nitpick bots, just open a PR and we can help sort it out and get it merged in.

### Integration Tests
We've set up a dockerized end-to-end test flow for concat + aleph. Take a look at it in action on [travis-ci](https://travis-ci.org/mediachain/aleph).
