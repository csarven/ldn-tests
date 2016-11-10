# Linked Data Notifications test suite

* Spec repository: https://github.com/w3c/ldn/
* Latest Published: https://www.w3.org/TR/ldn/
* Editor's Draft: https://linkedresearch.org/ldn/

```bash
$ git clone --recursive https://github.com/csarven/ldn-tests tests
$ cd tests/mayktso
$ npm install
$ cp config.json.default config.json (use a config like the following)
{
  "port": "8448",
  "rootPath": ".",
  "inboxPath": "inbox/",
  "queuePath": "queue/"
}
$ cd ..
$ mkdir inbox queue
$ node mayktso/app.js
```

We are at the root of `tests` running mayktso from there. Requests are relative
to this location (`rootPath` can be full path) e.g., http://localhost:8448/ ,
http://localhost:8448/inbox/ , http://localhost:8448/inbox/foo

Use `git submodule update --remote mayktso` from the tests root directory to
update the submodule from time to time.
