# Linked Data Notifications test suite

* Spec repository: https://github.com/w3c/ldn/
* Latest Published: https://www.w3.org/TR/ldn/
* Editor's Draft: https://linkedresearch.org/ldn/

```bash
$ git clone --recursive https://github.com/csarven/ldn-tests tests
$ cd tests/mayktso
$ npm install
$ cd ..
$ mkdir inbox queue
$ node mayktso/app.js
```

Make sure to run mayktso from the root of tests directory so that the built-in
defaults work. Otherwise, `cp config.json.default config.json` and play around.
See mayktso for more details on the config.

Requests to http://localhost:3000/ , http://localhost:3000/inbox/ should work
and http://localhost:3000/inbox/abcdef after a POST.

Use `git submodule update --remote mayktso` from the tests root directory to
update the submodule from time to time.


## Dependencies
* [mayktso](https://github.com/csarven/mayktso)

## License
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)
