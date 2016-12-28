# Linked Data Notifications test suite

* Spec repository: https://github.com/w3c/ldn/
* Latest Published: https://www.w3.org/TR/ldn/
* Editor's Draft: https://linkedresearch.org/ldn/

The test suite is in progress at: https://linkedresearch.org/ldn/tests/

Stay tuned.. or if you are a legendary Web developer, dive into:

## Setup
```bash
$ git clone https://github.com/csarven/ldn-tests tests
$ cd tests && mkdir inbox
$ npm install
$ node index.js
```

That will start a maytkso server on http://localhost:3000/ by default. That will
be the landing page pointing at sender, receiver, and consumer tests.

See [mayktso](https://github.com/csarven/mayktso) for more details on the config
. If you want to use your own config, copy the default and update:

```bash
cp node_modules/mayktso/config.json.default node_modules/mayktso/config.json
```

Requests to http://localhost:3000/ , http://localhost:3000/inbox/ should work
and http://localhost:3000/inbox/abcdef after a POST.

## Dependencies
* [mayktso](https://github.com/csarven/mayktso)

## License
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)
