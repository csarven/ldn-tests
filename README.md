# Linked Data Notifications test suite

* Spec repository: https://github.com/w3c/ldn/
* Latest Published: https://www.w3.org/TR/ldn/
* Editor's Draft: https://linkedresearch.org/ldn/

The test suite is in progress at: https://linkedresearch.org/ldn/tests/

Stay tuned.. or if you are a legendary Web developer, dive into:

## Setup
```bash
$ git clone https://github.com/csarven/ldn-tests tests
$ npm install
$ node index.js
```

Make sure to run mayktso from the root of tests directory so that the built-in
defaults work. Otherwise,
`cp mayktso/node_modules/config.json.default maytkso/node_modules/config.json`
and config to your needs. See [mayktso](https://github.com/csarven/mayktso) for
more details on the config.

Requests to http://localhost:3000/ , http://localhost:3000/inbox/ should work
and http://localhost:3000/inbox/abcdef after a POST.

## Dependencies
* [mayktso](https://github.com/csarven/mayktso)

## License
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)
