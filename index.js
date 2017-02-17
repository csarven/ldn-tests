var fs = require('fs');
var etag = require('etag');
var uuid = require('node-uuid');
var btoa = require("btoa");
var atob = require("atob");
var mayktso = require('mayktso');

var config = mayktso.config();
mayktso.init({'config': config, 'omitRoutes': ['/media', '/sender', '/target/:id', '/receiver', '/consumer', '/discover-inbox-rdf-body', '/discover-inbox-link-header', '/inbox-compacted/$', '/inbox-expanded/$', '/inbox-sender/$', '/send-report', '/summary']});

if(!fs.existsSync('inbox-sender')) { fs.mkdirSync('inbox-sender') }

mayktso.app.use('/media', mayktso.express.static(__dirname + '/media'));
mayktso.app.route('/send-report').all(reportTest);
mayktso.app.route('/summary').all(showSummary);

mayktso.app.route('/sender').all(testSender);
mayktso.app.route('/target/:id').all(getTarget);

mayktso.app.route('/receiver').all(testReceiver);

mayktso.app.route('/consumer').all(testConsumer);
mayktso.app.route('/discover-inbox-link-header').all(getTarget);
mayktso.app.route('/discover-inbox-rdf-body').all(getTarget);
mayktso.app.route('/inbox-compacted/').all(function(req, res, next){
  mayktso.handleResource(req, res, next, { jsonld: { profile: 'http://www.w3.org/ns/json-ld#compacted' }});
});
mayktso.app.route('/inbox-expanded/').all(function(req, res, next){
  mayktso.handleResource(req, res, next, { jsonld: { profile: 'http://www.w3.org/ns/json-ld#expanded' }});
});
mayktso.app.route('/inbox-sender/').all(function(req, res, next){
  mayktso.handleResource(req, res, next, { jsonld: { profile: 'http://www.w3.org/ns/json-ld#expanded' }, storeMeta: true, allowSlug: true });
});

// console.log(mayktso.app._router.stack);

var getResource = mayktso.getResource;
var getResourceHead = mayktso.getResourceHead;
var getResourceOptions = mayktso.getResourceOptions;
var postResource = mayktso.postResource;
var htmlEntities = mayktso.htmlEntities;
var preSafe = mayktso.preSafe;
var vocab = mayktso.vocab;
var prefixes = mayktso.prefixes;
var prefixesRDFa = mayktso.prefixesRDFa;
var getGraph = mayktso.getGraph;
var getGraphFromData = mayktso.getGraphFromData;
var serializeData = mayktso.serializeData;
var SimpleRDF = mayktso.SimpleRDF;
var RDFstore = mayktso.RDFstore;
var parseLinkHeader = mayktso.parseLinkHeader;
var parseProfileLinkRelation = mayktso.parseProfileLinkRelation;
var getBaseURL = mayktso.getBaseURL;
var getExternalBaseURL = mayktso.getExternalBaseURL;
var XMLHttpRequest = mayktso.XMLHttpRequest;
var discoverInbox = mayktso.discoverInbox;
var getInboxNotifications = mayktso.getInboxNotifications;

var ldnTestsVocab = {
  "earlAssertion": { "@id": "https://www.w3.org/ns/earl#Assertion", "@type": "@id" },
  "earlinfo": { "@id": "https://www.w3.org/ns/earl#info" },
  "earloutcome": { "@id": "https://www.w3.org/ns/earl#outcome", "@type": "@id" },
  "earlsubject": { "@id": "https://www.w3.org/ns/earl#subject", "@type": "@id" },
  "earlresult": { "@id": "https://www.w3.org/ns/earl#result", "@type": "@id" },
  "earltest": { "@id": "https://www.w3.org/ns/earl#test", "@type": "@id" },
  "qbObservation": { "@id": "http://purl.org/linked-data/cube#Observation", "@type": "@id" },
  "doapname": { "@id": "http://usefulinc.com/ns/doap#name" }
}
Object.assign(vocab, ldnTestsVocab);

var ldnTests = {
  'sender': {
    'checkDiscoverInbox': {
      'description': 'Inbox discovery.',
      'earl:mode': 'earl:automatic'
    },
    'checkPost': {
      'description': 'Makes <code>POST</code> requests.',
      'earl:mode': 'earl:automatic'
    },
    'checkPostContentTypeJSONLD': {
      'description': '<code>POST</code> includes <code>Content-Type: application/ld+json</code>.',
      'earl:mode': 'earl:automatic'
    },
    'checkPostRequestBodyJSONLD': {
      'description': '<code>POST</code> payload is JSON-LD.',
      'earl:mode': 'earl:automatic'
    }
  },
  'consumer': {
    'checkDiscoverInboxLinkHeader': {
      'description': 'Inbox discovery via <code>Link</code> header.',
      'earl:mode': 'earl:semiAuto'
    },
    'checkDiscoverInboxRDFBody': {
      'description': 'Inbox discovery via RDF body.',
      'earl:mode': 'earl:semiAuto'
    },
    'checkDiscoverNotificationJSONLDCompacted': {
      'description': 'Notification discovery from Inbox using JSON-LD compacted form.',
      'earl:mode': 'earl:semiAuto'
    },
    'checkDiscoverNotificationJSONLDExpanded': {
      'description': 'Notification discovery from Inbox using JSON-LD expanded form.',
      'earl:mode': 'earl:semiAuto'
    },
    'checkNotificationAnnounce': {
      'description': 'Contents of the announce notifications.',
      'earl:mode': 'earl:semiAuto'
    },
    'checkNotificationChangelog': {
      'description': 'Contents of the changelog notifications.',
      'earl:mode': 'earl:semiAuto'
    },
    'checkNotificationCitation': {
      'description': 'Contents of the citation notifications.',
      'earl:mode': 'earl:semiAuto'
    },
    'checkNotificationAssessing': {
      'description': 'Contents of the assessing notifications.',
      'earl:mode': 'earl:semiAuto'
    },
    'checkNotificationComment': {
      'description': 'Contents of the comment notifications.',
      'earl:mode': 'earl:semiAuto'
    },
    'checkNotificationRSVP': {
      'description': 'Contents of the rsvp notifications.',
      'earl:mode': 'earl:semiAuto'
    }
  },
  'receiver': {
    'checkHead': {
      'description': 'Accepts <code>HEAD</code> requests.',
      'earl:mode': 'earl:automatic'
    },

    'checkOptions': {
      'description': 'Accepts <code>OPTIONS</code> requests.',
      'earl:mode': 'earl:automatic'
    },
    'checkOptionsAcceptPost': {
      'description': 'Advertises acceptable content types with <code>Accept-Post</code> in response to <code>OPTIONS</code> request.',
      'earl:mode': 'earl:automatic'
    },
    'checkOptionsAcceptPostContainsJSONLD': {
      'description': '<code>Accept-Post</code> includes <code>application/ld+json</code>.',
      'earl:mode': 'earl:automatic'
    },

    'checkPost': {
      'description': 'Accepts <code>POST</code> requests.',
      'earl:mode': 'earl:automatic'
    },
    'checkPostResponseCreated': {
      'description': 'Responds to <code>POST</code> requests with <code>Content-Type: application/ld+json</code> with status code <code>201 Created</code> or <code>202 Accepted</code>.',
      'earl:mode': 'earl:automatic'
    },
    'checkPostResponseLocation': {
      'description': 'Returns a <code>Location</code> header in response to successful <code>POST</code> requests.',
      'earl:mode': 'earl:automatic'
    },
    'checkPostResponseProfileLinkRelationAccepted': {
      'description': 'Succeeds when the content type includes a <code>profile</code> parameter.',
      'earl:mode': 'earl:automatic'
    },
    // 'checkPostResponseBody': {
    //   'description': 'TODO: Read the body'... I don't remember what this was for and if it is already covered.
    // },
    'checkPostResponseConstraintsUnmet': {
      'description': 'Fails to process notifications if implementation-specific constraints are not met.',
      'earl:mode': 'earl:automatic'
    },

    'checkGet': {
      'description': 'Returns JSON-LD on <code>GET</code> requests.',
      'earl:mode': 'earl:automatic'
    },
    'checkGetResponseLDPContains': {
      'description': 'Lists notification URIs with <code>ldp:contains</code>.',
      'earl:mode': 'earl:automatic'
    },
    'checkGetResponseNotificationsLimited': {
      'description': 'Restricts list of notification URIs (eg. according to access control).',
      'earl:mode': 'earl:semiAuto'
    },
    'checkGetResponseNotificationsJSONLD': {
      'description': 'Notifications are available as JSON-LD.',
      'earl:mode': 'earl:automatic'
    },
    'checkGetResponseNotificationsRDFSource': {
      'description': 'When requested with no <code>Accept</code> header or <code>*/*</code>, notifications are still returned as RDF.',
      'earl:mode': 'earl:automatic'
    },
    'extraCheckGetResponseLDPContainer': {
      'description': 'Inbox has type <code>ldp:Container</code>.',
      'earl:mode': 'earl:automatic'
    },
    'extraCheckGetResponseLDPConstrainedBy': {
      'description': 'Advertises constraints with <code>ldp:constrainedBy</code>.',
      'earl:mode': 'earl:automatic'
    }
  }
}


function testSender(req, res, next){
// console.log(req.requestedPath);
// console.log(req);

  switch(req.method){
    case 'GET':
      if(!req.requestedType){
        res.status(406);
        res.end();
        return next();
      }

      var data = getTestSenderHTML(req);

      if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
        res.status(304);
        res.end();
        break;
      }

      res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
      res.set('Content-Type', 'text/html;charset=utf-8');
      res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
      res.set('ETag', etag(data));
      res.set('Vary', 'Origin');
      res.set('Allow', 'GET, POST');
      res.status(200);
      res.send(data);
      return next();
      break;

    case 'POST':

      break;

    default:
      res.status(405);
      res.set('Allow', 'GET, POST');
      res.end();
      return next();
      break;
  }
}


function getTestSenderHTML(req, results){
  var targetId = uuid.v1();
  var targetIRI = getExternalBaseURL(req.getUrl()) + 'target/' + targetId;

  return `<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta charset="utf-8" />
        <title>LDN Tests for Senders</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="${req.getRootUrl()}/media/css/ldntests.css" media="all" rel="stylesheet" />
    </head>

    <body about="" prefix="${prefixesRDFa}" typeof="schema:CreativeWork sioc:Post prov:Entity">
        <main>
            <article about="" typeof="schema:Article">
                <h1 property="schema:name">LDN Tests for Senders</h1>

                <div id="content">
                    <section id="senders" inlist="" rel="schema:hasPart" resource="#senders">
                        <h2 property="schema:name">Sender</h2>
                        <div datatype="rdf:HTML" property="schema:description">
                            <p>Run your sender software to this target:</p>
                            <p><code><a href="${targetIRI}">${targetIRI}</a></code></p>
                        </div>
                    </section>
                </div>
            </article>
        </main>
    </body>
</html>
`;
}

function testReceiver(req, res, next){
// console.log(req.requestedPath);
// console.log(req);

  switch(req.method){
    case 'GET':
      if(!req.accepts(['text/html', 'application/xhtml+xml', '*/*'])) {
        res.status(406);
        res.end();
        return next();
      }

      var data = getTestReceiverHTML(req);

      if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
        res.status(304);
        res.end();
        break;
      }

      res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
      res.set('Content-Type', 'text/html;charset=utf-8');
      res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
      res.set('ETag', etag(data));
      res.set('Vary', 'Origin');
      res.set('Allow', 'GET, POST');
      res.status(200);
      res.send(data);
      return next();
      break;

    case 'POST':
      var testReceiverPromises = [];
      var initTest = { '1': checkOptions, '2': checkHead, '3': checkPost, '4': checkGet };
      // var initTest = { '1': checkOptions };
      // var initTest = { '2': checkHead };
      // var initTest = { '3': checkPost };
      // var initTest = { '4': checkGet };

      if(req.body['test-receiver-url'] && (req.body['test-receiver-url'].toLowerCase().slice(0,7) == 'http://' || req.body['test-receiver-url'].toLowerCase().slice(0,8) == 'https://')) {
        Object.keys(initTest).forEach(function(id) {
          testReceiverPromises.push(initTest[id](req));
        });

        Promise.all(testReceiverPromises)
          .then((results) => {
// console.dir(results);
            var resultsData = {};
            results.forEach(function(r){
              Object.assign(resultsData, r['receiver']);
            });
// console.dir(resultsData);

            var reportHTML = getTestReportHTML(resultsData, 'receiver');
            var test = {'url': req.body['test-receiver-url'] };
            test['implementationType'] = 'Receiver';
            test['results'] = resultsData;

            resultsData['test-receiver-report-html'] = testResponse(req, test, reportHTML);

            var data = getTestReceiverHTML(req, resultsData);
// console.log(data);

            res.set('Content-Type', 'text/html;charset=utf-8');
            res.set('Allow', 'GET, POST');
            res.status(200);
            res.send(data);
            res.end();
            return next();
          })
          .catch((e) => {
            console.log('--- catch ---');
            console.log(e);
            res.end();
            return next();
          });
      }
      break;

    default:
      res.status(405);
      res.set('Allow', 'GET, POST');
      res.end();
      return next();
      break;
  }
}


function checkOptions(req){
  var testResults = { 'receiver': {} };
  var headers = {};
  headers['Content-Type'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
  var url = req.body['test-receiver-url'];
// console.log('checkOptions: ' + url);
  return getResourceOptions(url, headers).then(
    function(response){
        var acceptPost = response.xhr.getResponseHeader('Accept-Post');
        testResults['receiver']['checkOptions'] = { 'code': 'earl:passed', 'message': '' };
        if(acceptPost){
          testResults['receiver']['checkOptionsAcceptPost'] = { 'code': 'earl:passed', 'message': '<code>Accept-Post: ' + acceptPost + '</code>' };

          var acceptPosts = acceptPost.split(',');
          testResults['receiver']['checkOptionsAcceptPostContainsJSONLD'] = { 'code': 'earl:failed', 'message': '<code>Accept-Post: ' + acceptPost + '</code>' };
          acceptPosts.forEach(function(i){
            var m = i.trim();
            if(m == 'application/ld+json' || m == '*/*'){
              testResults['receiver']['checkOptionsAcceptPostContainsJSONLD'] = { 'code': 'earl:passed', 'message': '' };
            }
          })
        }
        else {
          testResults['receiver']['checkOptionsAcceptPost'] = { 'code': 'earl:failed', 'message': '<code>Accept-Post: ' + acceptPost + '</code>' };
        }
      return Promise.resolve(testResults);
    },
    function(reason){
      testResults['receiver']['checkOptions'] = { 'code': 'earl:inapplicable', 'message': '<code>HTTP ' + reason.xhr.status + '</code>' };
      return Promise.resolve(testResults);
    });
}

function checkHead(req){
  var testResults = { 'receiver': {} };
  var headers = {};
  headers['Content-Type'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
  var url = req.body['test-receiver-url'];
// console.log('checkHead: ' + url);
  return getResourceHead(url, headers).then(
    function(response){
      testResults['receiver']['checkHead'] = { 'code': 'earl:passed', 'message': '' };
      return Promise.resolve(testResults);
    },
    function(reason){
      testResults['receiver']['checkHead'] = { 'code': 'earl:inapplicable', 'message': '<code>HTTP ' + reason.xhr.status + '</code>' };
      return Promise.resolve(testResults);
    });
}

function checkGet(req){
  var testResults = { 'receiver': {} };
  var headers = {};
  headers['Accept'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
  var url = req.body['test-receiver-url'];
// console.log('checkGet: ' + url);
  return getResource(url, headers).then(
    function(response){
// console.log(response);
      testResults['receiver']['checkGetResponseNotificationsLimited'] = { 'code': 'earl:inapplicable', 'message': 'Check manually.' };

      var data = response.xhr.responseText;
      var contentType = response.xhr.getResponseHeader('Content-Type');
// console.log(contentType);
      if(typeof contentType == undefined){
          testResults['receiver']['checkGet'] = { 'code': 'earl:failed', 'message': 'No <code>Content-Type</code>. Inbox can not be parsed as <code>' + headers['Accept'] + '</code>.' };
          return Promise.resolve(testResults);
      }
      else if(contentType.split(';')[0].trim() != headers['Accept']) {
          testResults['receiver']['checkGet'] = { 'code': 'earl:failed', 'message': '<code>Content-Type: ' + contentType + '</code> returned. Inbox can not be parsed as <code>' + headers['Accept'] + '</code>.'};
          return Promise.resolve(testResults);
      }
      else {
        testResults['receiver']['checkGet'] = { 'code': 'earl:passed', 'message': '' };
        var options = {
          'contentType': 'application/ld+json',
          'subjectURI': url
        }

        return getGraphFromData(data, options).then(
          function(g) {
            var s = SimpleRDF(vocab, options['subjectURI'], g, RDFstore).child(options['subjectURI']);
console.log(s.iri().toString());

            //These checks are extra, not required by the specification
            var types = s.rdftype;
            var resourceTypes = [];
            types._array.forEach(function(type){
              resourceTypes.push(type);
            });
            var linkHeaders = parseLinkHeader(response.xhr.getResponseHeader('Link'));
            var rdftypes = [];
// console.log(linkHeaders);

            if('type' in linkHeaders && (linkHeaders['type'].indexOf(vocab.ldpcontainer["@id"]) || linkHeaders['type'].indexOf(vocab.ldpbasiccontainer["@id"]))){
              linkHeaders['type'].forEach(function(url){
                if(url == vocab.ldpcontainer["@id"] || url == vocab.ldpbasiccontainer["@id"]) {
                  rdftypes.push('<a href="' + url + '">' + url + '</a>');
                }
              });

              testResults['receiver']['extraCheckGetResponseLDPContainer'] = { 'code': 'earl:passed', 'message': 'Found in <code>Link</code> header: ' + rdftypes.join(', ') };
            }
            else if(resourceTypes.indexOf(vocab.ldpcontainer["@id"]) > -1 || resourceTypes.indexOf(vocab.ldpbasiccontainer["@id"]) > -1) {
              resourceTypes.forEach(function(url){
                if(url == vocab.ldpcontainer["@id"] || url == vocab.ldpbasiccontainer["@id"]) {
                  rdftypes.push('<a href="' + url + '">' + url + '</a>');
                }
              });

              testResults['receiver']['extraCheckGetResponseLDPContainer'] = { 'code': 'earl:passed', 'message': 'Found in body: ' + rdftypes.join(', ') };
            }
            else {
              testResults['receiver']['extraCheckGetResponseLDPContainer'] = { 'code': 'earl:inapplicable', 'message': 'Not found.' };
            }

            if (vocab['ldpconstrainedBy']['@id'] in linkHeaders && linkHeaders[vocab['ldpconstrainedBy']['@id']].length > 0) {
              var constrainedBys = [];
              linkHeaders[vocab['ldpconstrainedBy']['@id']].forEach(function(url){
                constrainedBys.push('<a href="' + url + '">' + url + '</a>');
              });

              testResults['receiver']['extraCheckGetResponseLDPConstrainedBy'] = { 'code': 'earl:passed', 'message': 'Found: ' + constrainedBys.join(', ') };
            }
            else {
              testResults['receiver']['extraCheckGetResponseLDPConstrainedBy'] = { 'code': 'earl:inapplicable', 'message': 'Not found.' };
            }

            var notifications = [];
            s.ldpcontains.forEach(function(resource) {
                notifications.push(resource.toString());
            });

            if(notifications.length > 0) {
              testResults['receiver']['checkGetResponseLDPContains'] = { 'code': 'earl:passed', 'message': 'Found ' + notifications.length + ' notifications.' };

              var testAccepts = ['application/ld+json', '*/*', ''];
              var notificationResponses = [];

              var getSerialize = function(url, acceptValue) {
                return new Promise(function(resolve, reject) {
                  var http = new XMLHttpRequest();
                  http.open('GET', url);
                  if(acceptValue.length > 0){
                    http.setRequestHeader('Accept', acceptValue);
                  }
                  http.onreadystatechange = function() {
                    if(this.readyState == this.DONE) {
                      var anchor = '<a href="' + url + '">' + url + '</a>';

                      if (this.status === 200) {
                        var data = this.responseText;
                        var cT = this.getResponseHeader('Content-Type');
                        var contentType = cT.split(';')[0].trim();

                        if(acceptValue == 'application/ld+json' && contentType != 'application/ld+json') {
                          resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'code': 'earl:failed', 'message': anchor + ': <code>Accept: ' + acceptValue + '</code> != <code>Content-Type: ' + cT + '</code>' });
                        }
                        else {
                          var options = { 'subjectURI': '_:ldn' }
                          var codeAccept = (acceptValue == '') ? 'No <code>Accept</code>' : '<code>Accept: ' + acceptValue + '</code>';
                          serializeData(data, contentType, 'application/ld+json', options).then(
                            function(i){
                              resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'code': 'earl:passed', 'message': anchor + ': ' + codeAccept + ' => <code>Content-Type: ' + cT + '</code> <em>can</em> be serialized as JSON-LD' });
                            },
                            function(reason){
                              resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'code': 'earl:failed', 'message': anchor + ': ' + codeAccept + ' => <code>Content-Type: ' + cT + '</code> <em>can not</em> be serialized as JSON-LD' });
                            }
                          );
                        }
                      }
                      else {
                        resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'code': 'earl:failed', 'message': anchor + ': HTTP status ' + this.status });
                      }
                    }
                  };
                  http.send();
                });
              }

              notifications.forEach(function(url){
                testAccepts.forEach(function(acceptValue){
                  notificationResponses.push(getSerialize(url, acceptValue));
                });
              });

              return Promise.all(notificationResponses)
                .then((results) => {
// console.log(results);

                  var notificationState = [];
                  var notificationStateJSONLD = [];
                  var notificationStateRDFSource = [];
                  var codeJSONLD = 'earl:passed';
                  var codeRDFSource = 'earl:passed';
                  results.forEach(function(r){
                    if(r['Accept'] == 'application/ld+json'){
                      if (r.code == 'earl:failed') { codeJSONLD = 'earl:failed'; }
                      notificationStateJSONLD.push(r.message);
                    }
                    else {
                      if (r.code == 'earl:failed') { codeRDFSource = 'earl:failed'; }
                      notificationStateRDFSource.push(r.message);
                    }
                    notificationState.push(r.message);
                  });
                  notificationStateJSONLD = notificationStateJSONLD.join(', ');
                  notificationStateRDFSource = notificationStateRDFSource.join(', ');

                  testResults['receiver']['checkGetResponseNotificationsJSONLD'] = { 'code': codeJSONLD, 'message': notificationStateJSONLD };
                  testResults['receiver']['checkGetResponseNotificationsRDFSource'] = { 'code': codeRDFSource, 'message': notificationStateRDFSource };

                  return Promise.resolve(testResults);
                })
                .catch((e) => {
                  console.log('--- catch: notificationResponses ---');
                  console.log(e);
                });
            }
            else {
              testResults['receiver']['checkGetResponseLDPContains'] = { 'code': 'earl:inapplicable', 'message': 'Did not find <code>ldp:contains</code>. It may because there are no notifications yet.' };
              return Promise.resolve(testResults);
            }
          },
          function(reason){
console.log(reason);
            testResults['receiver']['checkGet'] = { 'code': 'earl:failed', 'message': 'Inbox can not be parsed as <code>' + headers['Accept'] + '</code>.' };
            return Promise.resolve(testResults);
          });
      }
    },
    function(reason){
// console.log(reason);
      testResults['receiver']['checkGet'] = { 'code': 'earl:failed', 'message': '<code>HTTP '+ reason.xhr.status + '</code>, <code>Content-Type: ' + reason.xhr.getResponseHeader('Content-Type') + '</code>' };
      return Promise.resolve(testResults);
    });
}



function checkPost(req){
  var testResults = { 'receiver': {} };
  var headers = {};
  var url = req.body['test-receiver-url'];
  headers['Content-Type'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json; profile="http://example.org/profile"; charset=utf-8';
  headers['Slug'] = uuid.v1() + '.jsonld';
  var data = ('test-receiver-data' in req.body && req.body['test-receiver-data'].length > 0) ? req.body['test-receiver-data'] : '';
// console.log('checkGet: ' + url);
  return postResource(url, headers['Slug'], data, headers['Content-Type']).then(
    function(response){
// console.log(response);
      // POST requests are supported, with and without profiles
      var status = '<code>HTTP ' + response.xhr.status + '</code>';
      testResults['receiver']['checkPost'] = { 'code': 'earl:passed', 'message': status };
      testResults['receiver']['checkPostResponseProfileLinkRelationAccepted'] = { 'code': 'earl:passed', 'message': '' };

      // If 201 or 202
      if(response.xhr.status == 201 || response.xhr.status == 202) {
        // If 'reject' was ticked, creating was wrong, fail
        if('test-receiver-reject' in req.body){
          testResults['receiver']['checkPostResponseCreated'] = { 'code' : 'earl:failed', 'message' : 'Payload did NOT meet constraints, but the receiver indicated success (' + status + ')' };
          testResults['receiver']['checkPostResponseConstraintsUnmet'] = { 'code': 'earl:failed', 'message': '' };
          return Promise.resolve(testResults);

        // Otherwise, pass
        }
        else{
          testResults['receiver']['checkPostResponseCreated'] = { 'code': 'earl:passed', 'message': status };

          // If 201, check Location header
          if(response.xhr.status == 201){
            var location = response.xhr.getResponseHeader('Location');
            if(location){
              var url = location;
              if(location.toLowerCase().slice(0,4) != 'http') {
                //TODO: baseURL for response.xhr.getResponseHeader('Location') .. check response.responseURL?
                var port = (response.xhr._url.port) ? response.xhr._url.port : '';
                url = response.xhr._url.protocol + '//' + response.xhr._url.hostname + port + location;
              }

              var headers = {};
              headers['Accept'] = 'application/ld+json';

              return getResource(url, headers).then(
                //Maybe use checkPostResponseLocationRetrieveable
                function(i){
// console.log(i);
                  testResults['receiver']['checkPostResponseLocation'] = { 'code': 'earl:passed', 'message': '<code>Location</code>: <a href="' + url + '">' + url + '</a> found and can be retrieved.' };
                  return Promise.resolve(testResults);
                },
                function(j){
// console.log(j);
                  testResults['receiver']['checkPostResponseLocation'] = { 'code': 'earl:failed', 'message': '<code>Location</code>: <a href="' + url + '">' + url + '</a> found but can not be retrieved: <code>HTTP ' + j.xhr.status + '</code> <q>' + j.xhr.responseText + '</q>' };
                  return Promise.resolve(testResults);
                });
            }
            else {
              testResults['receiver']['checkPostResponseLocation'] = { 'code': 'earl:failed', 'message': '<code>Location</code> header not found.' };
              return Promise.resolve(testResults);
            }
          }
        }
      }
      else {
        testResults['receiver']['checkPost'] = { 'code': 'earl:failed', 'message': 'Response was <code>HTTP ' + response.xhr.status + '</code>. Should return <code>HTTP 201</code>.'};
        return Promise.resolve(testResults);
      }
    },
    function(reason){
// console.log(reason);
      var status = '<code>HTTP ' + reason.xhr.status + '</code>';
      var responseText = (reason.xhr.responseText.length > 0 ) ? ', <q>' + reason.xhr.responseText + '</q>' : '';

      testResults['receiver']['checkPost'] = { 'code': 'earl:failed', 'message': status + responseText };
      switch(reason.xhr.status){
        case 400:
          if('test-receiver-reject' in req.body) {
            testResults['receiver']['checkPost'] = { 'code': 'earl:passed', 'message': 'Deliberately rejected (' + status + ')' };
            testResults['receiver']['checkPostResponseConstraintsUnmet'] = { 'code': 'earl:passed', 'message': 'Payload successfully filtered out (' + status + ')' };
          }
          //TODO: Maybe handle other formats here
          if(headers['Content-Type'] == 'application/ld+json'){ //TODO: && payload format is valid
            testResults['receiver']['checkPostResponseCreated'] = { 'code': 'earl:failed', 'message': '<em class="rfc2119">MUST</em> accept notifications where the request body is JSON-LD, with the <code>Content-Type: application/ld+json</code>' };
          }
          break;
        case 405:
          testResults['receiver']['checkPost'] = { 'code': 'earl:failed', 'message': '<em class="rfc2119">MUST</em> support <code>POST</code> request on the Inbox URL.' };
          break;
        case 415:
          if('test-receiver-reject' in req.body) {
            testResults['receiver']['checkPost'] = { 'code': 'earl:passed', 'message': status + '. Request with <code>Content-Type: ' + headers['Content-Type'] + '</code> has been rejected.' };
          }
          else {
            testResults['receiver']['checkPost'] = { 'code': 'earl:failed', 'message': status + '. Request with <code>Content-Type: ' + headers['Content-Type'] + '</code> is not allowed, or the payload does not correspond to this content-type. Check the payload syntax is valid, and make sure that the receiver is not having trouble with the <code>profile</code> or <code>charset</code> parameter.</code>.' };
          }
          testResults['receiver']['checkPostResponseProfileLinkRelationAccepted'] = { 'code': 'earl:inapplicable', 'message': 'The request was possibly rejected due to the <q>profile</q> Link Relation. If the mediatype is recognised, it may be better to accept the request by ignoring the profile parameter.' };
          break;
        default:
          testResults['receiver']['checkPost'] = { 'code': 'earl:failed', 'message': status + responseText};
          break;
      }

      return Promise.resolve(testResults);
    });
}

function getEarlOutcomeCode(outcome){
  var s = outcome;
  switch(outcome) {
    default: s = outcome; break;
    case 'earl:passed': s = '✔'; break;
    case 'earl:failed': s = '✗'; break;
    case 'earl:inapplicable': s = '-'; break;
  }
  return s;
}

function getTestReportHTML(test, implementation){
  var s = [];
  implementation = implementation || 'receiver';

  Object.keys(ldnTests[implementation]).forEach(function(id){
    var testResult = '';

    if(typeof test[id] == 'undefined'){
      test[id] = { 'code': 'earl:inapplicable', 'message': '' };
    }

    testResult = getEarlOutcomeCode(test[id]['code']);

    s.push('<tr id="test-' + id + '"><td class="test-result ' + test[id]['code'] + '">' + testResult + '</td><td class="test-description">' + ldnTests[implementation][id]['description'] + '</td><td class="test-message">' + test[id]['message'] + '</td></tr>');
  });

  return s.join("\n");
}

function testResponse(req, test, reportHTML){
  var sendReportURL = req.getRootUrl() + '/send-report';
  return `
    <div id="test-response">
      <table id="test-report">
        <caption>Test report</caption>
        <thead><tr><th>Result</th><th>Test</th><th>Notes</th></tr></thead>
        <tfoot><tr><td colspan="4">
          <dl>
            <dt class="earl:passed"><abbr title="Passed">✔</abbr></dt><dd>Passed</dd>
            <dt class="earl:failed"><abbr title="Failed">✗</abbr></dt><dd>Failed</dd>
            <dt class="earl:inapplicable"><abbr title="Inapplicable">-</abbr></dt><dd>Inapplicable</dd>
            </dl>
        </td></tr></tfoot>
        <tbody>
    ${reportHTML}
        </tbody>
      </table>
      <form action="${sendReportURL}" class="form-tests" method="post">
        <fieldset>
          <legend>Send LDN ${test['implementationType']} report</legend>
          <ul>
          <li>
            <label for="implementation">Implementation</label>
            <input type="text" name="implementation" value="" placeholder="URI of the project/implementation." /> (required)
          </li>
          <li>
            <label for="name">Implementation name</label>
            <input type="text" name="name" value="" placeholder="Name of the project/implementation." /> (required)
          </li>
          <li>
            <label for="maintainer">Maintainer</label>
            <input type="text" name="maintainer" value="" placeholder="URI of the maintainer, project leader, or organisation." /> (required)
          </li>
          <li>
            <label for="note">Note</label>
            <textarea name="note" cols="80" rows="2" placeholder="Enter anything you would like to mention."></textarea>
          </li>
          </ul>

          <input type="hidden" name="test-report-value" value="${btoa(JSON.stringify(test))}" />
          <input type="submit" value="Send Report" />
        </fieldset>
      </form>
    </div>`;
}

function getSelectOptionsHTML(options, selectedOption) {
  console.log(options);
  console.log(selectedOption);
  var s = '';
  options.forEach(function(o){
    var selected = '';
    if(o == selectedOption) {
      selected = ' selected="selected"';
    }
    s += '<option value="' + o + '"' + selected +'>' + o + '</option>\n\
';
  });
  return s;
}

function getTestReceiverHTML(req, results){
  // var selectedOption = (request && request['test-receiver-method']) ? request['test-receiver-method'] : '';
  // var receiverMethodOptionsHTML = getSelectOptionsHTML(['GET', 'HEAD', 'OPTIONS', 'POST'], selectedOption);
  // selectedOption = (request && request['test-receiver-mimetype']) ? request['test-receiver-mimetype'] : '';
  // var receiverMimetypeOptionsHTML = getSelectOptionsHTML(['application/ld+json', 'text/turtle'], selectedOption);
  var testsList = '';
  Object.keys(ldnTests['receiver']).forEach(function(t) {
    testsList += '<li id="'+t+'" about="#'+t+'" typeof="earl:TestCriterion" property="schema:description">'+ldnTests['receiver'][t]['description']+'</li>\n';
  });
  return `<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta charset="utf-8" />
        <title>LDN Tests for Receivers</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="${req.getRootUrl()}/media/css/ldntests.css" media="all" rel="stylesheet" />
    </head>

    <body about="" prefix="${prefixesRDFa}" typeof="schema:CreativeWork sioc:Post prov:Entity">
        <main>
            <article about="" typeof="schema:Article">
                <h1 property="schema:name">LDN Tests for Receivers</h1>

                <div id="content">
                    <section id="receiver" inlist="" rel="schema:hasPart" resource="#receiver">
                        <h2 property="schema:name">Receiver</h2>
                        <div datatype="rdf:HTML" property="schema:description">
                            <p>This form is to test implementations of LDN receivers. Input the URL of an Inbox, and when you submit, it fires off several HTTP requests with the various combinations of parameters and headers that you are required to support in order for senders to create new notifications and consumers to retreive them. It returns a <span class="earl:passed">passed</span>/<span class="earl:failed">failed</span> response for individual requirements of the LDN spec. It also tests some optional features; you'll get an <span class="earl:inapplicable">inapplicable</span> response if you don't implement them, rather than a fail.</p>
                            <p>We provide a default notification payload, but if you have a specilised implementation you may want to modify this to your needs.</p>
                            <p>If your receiver is setup to reject certain payloads (LDN suggests you implement some kinds of constraints or filtering), you can input one such payload and check the <q>Receiver should reject this notification</q> box. If your receiver rejects the POST requests, you will <em>pass</em> the relevant tests.</p>
                            <p>Reports will be submitted to an <a about="" rel="ldp:inbox" href="reports/">inbox</a>.</p>

                            <form action="" class="form-tests" id="test-receiver" method="post">
                                <fieldset>
                                    <legend>Test Receiver</legend>

                                    <ul>
                                         <li>
                                            <label for="test-receiver-url">URL</label>
                                            <input type="text" name="test-receiver-url" placeholder="https://linkedresearch.org/ldn/tests/inbox/" value="" />
                                        </li>

                                        <li>
                                            <label for="test-receiver-data">Data</label>
                                            <textarea name="test-receiver-data" cols="80" rows="3" placeholder="Enter data">{ "@id": "http://example.net/note#foo", "http://schema.org/citation": { "@id": "http://example.org/article#results" } }</textarea>
                                        </li>
                                        <li>
                                            <input type="checkbox" name="test-receiver-reject" checkbox="checkbox" />
                                            <label for="test-receiver-reject">Receiver should reject this notification</label>
                                        </li>
                                    </ul>

                                    <input type="hidden" name="test-implementation" value="receiver" />
                                    <input type="submit" value="Submit" />
                                </fieldset>
                            </form>
${(typeof results !== 'undefined' && 'test-receiver-report-html' in results) ? results['test-receiver-report-html'] : ''}
                        </div>
                    </section>
                    <section id="tests" inlist="" rel="schema:hasPart" resource="#tests">
                      <h2 property="schema:name">For reference, the tests that will run are:</h2>
                      <ul>
${testsList}
                      </ul>
                    </section>
                </div>
            </article>
        </main>
    </body>
</html>
`;
}


function createTestReportTurtle(req, res, next){
  var test = JSON.parse(atob(req.body['test-report-value']));
  var observations = [];
  var date = new Date();
  var dateTime = date.toISOString();

  var prefixes = `@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix dcterms: <http://purl.org/dc/terms/>.
@prefix as: <https://www.w3.org/ns/activitystreams#>.
@prefix qb: <http://purl.org/linked-data/cube#>.
@prefix doap: <http://usefulinc.com/ns/doap#>.
@prefix earl: <https://www.w3.org/ns/earl#>.
@prefix ldnTests: <https://linkedresearch.org/ldn/tests/#>.
@prefix ldn: <https://www.w3.org/TR/ldn/#>.
@prefix : <>.
@prefix d: <#>.`;

  var implementation = '';
  var maintainer = '';
  if(req.body['implementation'] && req.body['implementation'].length > 0 && req.body['implementation'].startsWith('http') && req.body['maintainer'] && req.body['maintainer'].length > 0 && req.body['maintainer'].startsWith('http')) {
    implementation = req.body['implementation'].trim();
    maintainer = req.body['maintainer'].trim();
    name = req.body['name'].trim();
  }
  else {
    res.status(400);
    res.end();
    return next();
  }

  var doap = `<${implementation}>
  a doap:Project, ldn:${test['implementationType']};
  doap:name """${name}""";
  doap:maintainer <${maintainer}>.`;

  test['id'] = uuid.v1();

  var dataset = `<>
  a qb:DataSet, as:Object;
  dcterms:identifier "${test['id']}";
  as:published "${dateTime}"^^xsd:dateTime;
  as:creator <${maintainer}>`;

  if(req.body['note'] && req.body['note'].trim().length > 0){
    dataset = dataset + `;
  as:summary """${req.body['note'].trim()}"""^^rdf:HTML`;
  }
  dataset = dataset + '.';

  var datasetSeeAlso = [];
  Object.keys(test['results']).forEach(function(i){
    datasetSeeAlso.push('d:' + i);

    // TODO: for things that say 'check manually' should be earl:untested or earl:canttell

    var observation = `d:${i}
  a qb:Observation, earl:Assertion;
  qb:dataSet <>;
  earl:subject <${implementation}>;
  earl:test ldnTests:${i};
  earl:result d:${i}-result .\n`;

    observation += `d:${i}-result
  earl:outcome ${test['results'][i]['code']}`;
    if(test['results'][i]['message'] != '') {
      observation = observation + `;
  earl:info """${test['results'][i]['message']}"""^^rdf:HTML`;
    }

    observations.push(observation + ' .\n');
  });

  datasetSeeAlso = `<>
  rdfs:seeAlso ${datasetSeeAlso.join(', ')}.`

  observations = observations.join('\n');

  var data = `${prefixes}

${doap}

${dataset}

${datasetSeeAlso}

${observations}
`;
console.log(data);
  return data;
}


function createTestReport(req, res, next){
  var test = JSON.parse(atob(req.body['test-report-value']));
  var observations = [];
  var date = new Date();
  var dateTime = date.toISOString();

  var implementation = '';
  var maintainer = '';
  if(req.body['implementation'] && req.body['implementation'].length > 0 && req.body['implementation'].startsWith('http') && req.body['maintainer'] && req.body['maintainer'].length > 0 && req.body['maintainer'].startsWith('http')) {
    implementation = req.body['implementation'].trim();
    maintainer = req.body['maintainer'].trim();
    name = req.body['name'].trim();
  }
  else {
    res.status(400);
    res.end();
    return next();
  }

  test['id'] = uuid.v1();

  var doap = `<dl about="${implementation}" typeof="doap:Project ldn:${test['implementationType']}">
    <dt>Project</dt>
    <dd property="doap:name"><a href="${implementation}">${name}</a></dd>
    <dt>Implementation type</dt>
    <dd><a href="https://www.w3.org/TR/ldn/#${test['implementationType']}">${test['implementationType']}</a></dd>
    <dt>Maintainer</dt>
    <dd><a href="${maintainer}" property="doap:maintainer">${maintainer}</a></dd>
</dl>`;


  var datasetNote = '';
  if(req.body['note'] && req.body['note'].trim().length > 0){
    datasetNote = `
    <dt>Note</dt>
    <dd datatype="rdf:HTML" property="as:summary">${req.body['note'].trim()}</dd>`;
  }


  var dataset = `<dl about="" typeof="qb:DataSet as:Object">
    <dt>Identifier</dt>
    <dd property="dcterms:identifier">${test['id']}</dd>
    <dt>Published</dt>
    <dd><time datetime="${dateTime}" datatype="xsd:dateTime" property="as:published">${dateTime.slice(0, dateTime.indexOf("T"))}</time></dd>
    <dt>Creator</dt>
    <dd><a href="${maintainer}" property="as:creator">${maintainer}</a></dd>${datasetNote}
</dl>`;


  var datasetSeeAlso = [];
  Object.keys(test['results']).forEach(function(i){
    datasetSeeAlso.push('<meta resource="#' + i + '" />');
    // TODO: for things that say 'check manually' should be earl:untested or earl:canttell

    var earlInfo = '';
    if(test['results'][i]['message'] != '') {
      earlInfo = `<td property="earl:result" resource="#result-${i}"><span datatype="rdf:HTML" property="earl:info">${test['results'][i]['message']}</span></td>`;
    }
    else {
      earlInfo = `<td property="earl:result" resource="#result-${i}"><span datatype="rdf:HTML" property="earl:info"></span></td>`;
    }

    // <td property="earl:mode" resource="${test['results'][i]['mode']}">${test['results'][i]['mode'].substr(0, test['results'][i]['mode'].indexOf(':'))}</td>


    observations.push(`
        <tr about="#${i}" typeof="qb:Observation earl:Assertion">
            <td property="qb:dataSet" resource=""></td>
            <td property="earl:subject" resource="${implementation}">${name}</td>
            <td property="earl:test" resource="ldnTests:${i}">${i}</td>
            <td></td>
            <td property="earl:result" resource="#result-${i}"><span property="earl:outcome" resource="${test['results'][i]['code']}">${getEarlOutcomeCode(test['results'][i]['code'])}</span></td>
            ${earlInfo}
        </tr>`);
  });
  observations = observations.join('');

  datasetSeeAlso = datasetSeeAlso.join('');

  return `<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
      <meta charset="utf-8" />
      <title>Report</title>
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <link href="${req.getRootUrl()}/media/css/ldntests.css" media="all" rel="stylesheet" />
  </head>

  <body about="" prefix="${prefixesRDFa} ldn: https://www.w3.ogr/TR/ldn/# ldnTests: https://linkedresearch.org/ldn/tests/#" typeof="schema:CreativeWork sioc:Post prov:Entity">
      <main>
          <article about="" typeof="schema:Article qb:DataSet as:Object">
              <h1 property="schema:name">Report</h1>

              <div id="content">
                  <section>
                      <h2>Description of a project</h2>
                      <div>
${doap}
                      </div>
                  </section>

                  <section>
                      <h2>Dataset</h2>
                      <div>
${dataset}
                      </div>
                  </section>

                  <section>
                      <h2>Test results</h2>
                      <div>
<table>
    <caption></caption>
    <thead about="#data-structure-structure" typeof="qb:DataStructureDefinition">
        <tr>
            <th>DataSet</th>
            <th rel="qb:component" resource="#component-dimension-subject" typeof="qb:ComponentSpecification"><span rel="qb:componentProperty qb:dimension" resource="earl:subject" typeof="qb:DimensionProperty"><span property="skos:prefLabel" title="Test subject">Subject</span></span></th>
            <th rel="qb:component" resource="#component-dimension-test" typeof="qb:ComponentSpecification"><span rel="qb:componentProperty qb:dimension" resource="earl:test" typeof="qb:DimensionProperty"><span property="skos:prefLabel" title="Test criterion">Test</span></span></th>
            <th rel="qb:component" resource="#component-dimension-mode" typeof="qb:ComponentSpecification"><span rel="qb:componentProperty qb:dimension" resource="earl:mode" typeof="qb:DimensionProperty"><span property="skos:prefLabel" title="Describes how a test was carried out">Mode</span></span></th>
            <th rel="qb:component" resource="#component-measure-outcome" typeof="qb:ComponentSpecification"><span rel="qb:componentProperty qb:measure" resource="earl:outcome" typeof="qb:MeasureProperty"><span property="skos:prefLabel" title="Outcome of performing the test">Outcome</span></span></th>
            <th rel="qb:component" resource="#component-measure-info" typeof="qb:ComponentSpecification"><span rel="qb:componentProperty qb:measure" resource="earl:info" typeof="qb:MeasureProperty"><span property="skos:prefLabel" title="Additional warnings or error messages in a human-readable form">Info</span></span></th>
        </tr>
    </thead>
    <tfoot>
        <tr><td about="" colspan="6" rel="rdfs:seeAlso">${datasetSeeAlso}</td></tr>
    </tfoot>
    <tbody>
${observations}
    </tbody>
</table>
                      </div>
                  </section>
              </div>
          </article>
      </main>
  </body>
</html>
`;
}



function reportTest(req, res, next){
  if(req.method == 'POST') {
// console.log(req.body['test-report-value']);
    if(req.body['test-report-value'] && req.body['test-report-value'].length > 0) {
      var test = JSON.parse(atob(req.body['test-report-value']));
      var data = createTestReport(req, res, next);
    }
    else {
      //TODO error
    }

    var headers = {};
    headers['Content-Type'] = 'text/html;charset=utf-8';

    var baseURL = getBaseURL(req.getUrl());
    var base = baseURL.endsWith('/') ? baseURL : baseURL + '/';
    var basePath = config.basePath.endsWith('/') ? config.basePath : '';
    var reportsInbox = base + basePath + config.reportsPath;

    // serializeData(data, 'text/turtle', 'application/ld+json', { 'subjectURI': datasetURI }).then(
    //   function(i){
    //     console.log(i)
    //   }
    // );

    //TODO
      //Check if uuid exists, assign another
      //In order for ldnTests report submission to count as an LDN sender, it needs to discover the target's inbox. 1) add inbox to /ldn/tests/ 2) use dokieli's getEndpoint() and then send
    postResource(reportsInbox, test['id'], data, headers['Content-Type']).then(
      function(response){
        var location = response.xhr.getResponseHeader('Location');
        res.set('Content-Type', 'text/html;charset=utf-8');
        var responseBody = '';
        switch(response.xhr.status){
          case 201:
            responseBody = '<p>Okieli dokieli, report submitted: <a href="' + location + '">' + location + '</a></p>';
            break;
          case 202:
            responseBody = '<p>' + response.xhr.responseText + '</p><p><code>HTTP 202</code>: This is probably because the request content length was greater than <code>maxPayloadSize</code> in mayktso.</p>';
            break;
          default:
            break;
        }
        res.status(200);
        res.send(responseBody);
        res.end();
        return next();
      },
      function(reason){
        res.set('Content-Type', 'text/html;charset=utf-8');
        res.status(reason.xhr.status);
        res.send('Well, something went wrong: ' + reason.xhr.responseText);
        res.end();
        return next();
      }
    );
  }
  else {
    res.status(405);
    res.end();
    return next();
  }
}


function showSummary(req, res, next){
  switch(req.method){
    //TODO: This only responds to text/html. Maybe include RDFa? Anything new/interesting for the report?
    case 'GET':
      if(!req.accepts(['text/html', '*/*'])) {
        res.status(406);
        res.end();
        return next();
      }

      var fetchNotifications = function(url){
        // return new Promise(function(resolve, reject) {
          return discoverInbox(url).then(
            function(i){
              console.log('--- showSummary --')
              console.log(i);
              console.log('--//showSummary --')
              return i;
            },
            function(reason){
              console.log('--- FAIL showSummary --')
              console.log(reason);
              console.log('--- FAIL showSummary --')
              return reason;
            }
          );
        // });
      }

      //Discover Inbox
      var baseURL = getBaseURL(req.getUrl());
      var base = baseURL.endsWith('/') ? baseURL : baseURL + '/';
      var basePath = config.basePath.endsWith('/') ? config.basePath : '';
      var url = base + basePath + 'receiver';

      discoverInbox(url).then(
        function(inboxes){
          //get inbox contents
          return getResource(inboxes[0], { 'Accept': 'application/ld+json' }).then(
            function(response){
// console.log(response)
              var options = {
                'contentType': 'application/ld+json',
                'subjectURI': inboxes[0]
              }
              var data = response.xhr.responseText;
// console.log(data);
              //get list of notifications
              return getInboxNotifications(data, options).then(
                function(notifications){
// console.log(notifications)
                  var nData = [];
                  notifications.forEach(function(nURL){
                    nData.push(SimpleRDF(vocab, nURL, null, RDFstore).get())
                  })
                  return Promise.all(nData)
                });
            });
        })
        .then(
        function(s){//s is an array of SimpleRDF promises
///Just for debugging
// console.log(s);
          var results = [];
          s.forEach(function(g){
            var observationUris = g.rdfsseeAlso;

            observationUris.forEach(function(observationUri){
              var observationGraph = g.child(observationUri);
              var implementationUri = observationGraph.earlsubject;
              var implementationGraph = g.child(implementationUri);
              if(implementationGraph.doapname){
                var projectName = implementationGraph.doapname;
              }else{
                var projectName = implementationUri;
              }
              var resultGraph = g.child(observationGraph.earlresult)
              var outcome = resultGraph.earloutcome.split('#')[1];

              if(typeof results[implementationUri] === 'undefined'){
                results[implementationUri] = [];
              }
              results[implementationUri]["name"] = projectName;
              results[implementationUri][observationGraph.earltest] = 'earl:'+outcome;

            });
          });

console.log(results);
          var data = getReportsHTML(req, res, next, results);

          if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
            res.status(304);
            res.end();
            return next();
          }

          res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
          res.set('Content-Type', 'text/html;charset=utf-8');
          res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
          res.set('ETag', etag(data));
          res.set('Vary', 'Origin');
          res.set('Allow', 'GET');
          res.status(200);
          res.send(data);
          res.end();
          return next();
        },
        function(reason){
          res.status(500);
          res.end();
          return next();
        }
      );
      break;

    default:
      res.status(405);
      res.set('Allow', 'GET');
      res.end();
      return next();
      break;
  }
}

function getReportsHTML(req, res, next, data){
    var rTestsCount = Object.keys(ldnTests['receiver']).length;
    var cTestsCount = Object.keys(ldnTests['consumer']).length;
    var sTestsCount = Object.keys(ldnTests['sender']).length;
    var implCount = Object.keys(data).length;

    var trs = '<tr><th rowspan="2">Implementations</th><th colspan="' + rTestsCount + '">Receiver Tests</th></tr>';
    trs = trs + '<tr>';
    Object.keys(ldnTests['receiver']).forEach(function(test){
      trs = trs + ' <td title="' + test + '">' + test + '</td>';
    });
    trs = trs + '</tr>';

    Object.keys(data).forEach(function(result){
      trs = trs + '<tr>';
      trs = trs + '  <th><a href="' + result + '">' + data[result]['name'] + '</a></th>';
      Object.keys(ldnTests['receiver']).forEach(function(test){
        trs = trs + '  <td class="test-result ' + data[result]['https://linkedresearch.org/ldn/tests/#' + test] + '">'+getEarlOutcomeCode(data[result]['https://linkedresearch.org/ldn/tests/#' + test])+'</td>';
      });
      trs = trs + '</tr>';
    });

    return `<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta charset="utf-8" />
        <title>LDN Test Reports</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="${req.getRootUrl()}/media/css/ldntests.css" media="all" rel="stylesheet" />
    </head>

    <body about="" prefix="${prefixesRDFa}" typeof="schema:CreativeWork sioc:Post prov:Entity">
        <main>
            <article about="" typeof="schema:Article">
                <h1 property="schema:name">LDN Test Reports</h1>

                <div id="content">
                  <table id="ldn-test-receiver-summary">
                    <caption>Receiver summary</caption>
${trs}
                  </table>
                </div>
            </article>
        </main>
    </body>
</html>
`;
}


function getTarget(req, res, next){
// console.log(req.getUrl());
// console.log(req.originalUrl);
// console.log(getExternalBaseURL(req.getUrl()));
// console.log(req.protocol + "://" + req.header('host') + config.basePath + '/' + config.inboxPath);
// console.log('')
// console.log(req.requestedType);
  switch(req.method){
    case 'GET': case 'HEAD': case 'OPTIONS':
      break;
    default:
      res.status(405);
      res.set('Allow', 'GET, HEAD, OPTIONS');
      res.end();
      return next();
      break;
  }
  if(!req.requestedType){
    res.status(406);
    res.end();
    return next();
  }

  //XXX: We don't care about the error
  // if(error) {}
  var discoverInboxHTML = '';
  var requestedTarget = req.requestedPath;
  var reqresData = '';

  if(req.originalUrl.startsWith('/target/') && req.params.id && req.params.id.length > 0 && !req.params.id.match(/\/?\.\.+\/?/g)){
    requestedTarget = config.rootPath + '/inbox-sender/' + req.params.id;
  }

  var files = [requestedTarget, requestedTarget+'.json'];
// console.log(files);
  //XXX: This tries to open /discover-* even though they don't (ever?) exist
  //FIXME: If data doesn't exist and metaData exists, both are not in buffer. Why?

  // let readFileContents = files.map((file) => {
  //   return fsp.readFile(file, 'utf8')
  //     .catch(err => {
  //       return null
  //     })
  // })
  let fileContents = files.map((file) => {
    try {
      return fs.readFileSync(file, 'utf8')
    } catch (error) {
      return null
    }
  });
// console.log(fileContents);
    var data = (fileContents[0]) ? fileContents[0] : undefined;
    var metaData = (fileContents[1]) ? JSON.parse(fileContents[1]) : undefined;
// console.log(data);
// console.log(metaData);
    switch(req.originalUrl) {
      case '/discover-inbox-link-header':
        discoverInboxHTML = `<p>This target resource announces its Inbox in the HTTP headers.</p>`;
        break;
      case '/discover-inbox-rdf-body':
        discoverInboxHTML = `<p>This target resource announces its <a href="inbox-expanded/" rel="ldp:inbox">Inbox</a> right here.</p>`;
        break;
      default:
        if(req.originalUrl.startsWith('/target/')){
          var inboxBaseIRI = req.getRootUrl() + '/inbox-sender/';
          var inboxIRI = inboxBaseIRI + '?id=' + req.params.id;
          discoverInboxHTML = `<p>This target resource announces its inbox here:</p>
          <p><code><a href="${inboxIRI}" rel="ldp:inbox">${inboxIRI}</a></code></p>
          <p>New notifications sent to this Inbox will overwrite previous notification.</p>`;
          if(typeof data !== 'undefined' || typeof metaData !== 'undefined') {
            var notificationIRI = inboxBaseIRI + req.params.id;

// console.log(requestedTarget + '.json');
// console.log(JSON.stringify(JSON.parse(metaData).req));

            if (typeof metaData !== 'undefined'){
              var results= {};
              results['checkDiscoverInbox'] = { 'code': 'earl:passed', 'message': '' }
              results['checkPost'] = { 'code': 'earl:passed', 'message': '' }
              results['checkPostContentTypeJSONLD'] = { 'code': 'earl:inapplicable', 'message': '' }
              results['checkPostRequestBodyJSONLD'] = { 'code': 'earl:inapplicable', 'message': '' }

              if(metaData.req.headers["content-type"] == 'application/ld+json') {
                results['checkPostContentTypeJSONLD'] = { 'code': 'earl:passed', 'message': '' }
              }
              else {
                results['checkPostContentTypeJSONLD'] = { 'code': 'earl:failed', 'message': '<code>Content-Type: ' + metaData.req.headers["content-type"] + '</code> received. Use <code>application/ld+json</code>.' }
              }

              switch(parseInt(metaData.res.statusCode)){
                case 201: case 202:
                  results['checkPostRequestBodyJSONLD'] = { 'code': 'earl:passed', 'message': '' }
                  break;
                case 400:
                  results['checkPostRequestBodyJSONLD'] = { 'code': 'earl:failed', 'message': 'Send valid JSON-LD payload.' }
                  break;
              }

              var reportHTML = getTestReportHTML(results, 'sender');
              var test = {'url': 'TODO: ' };
              test['implementationType'] = 'Sender';
              test['results'] = results;

              results['test-sender-report-html'] = `
                  <section id="test-sender">
                      <h2>Sender report</h2>
                      <div>
${testResponse(req, test, reportHTML)}
                      </div>
                  </section>`;
            }

// console.log(results);
// console.log(test);
            //TODO: relocate this
            reqresData = `
                    <section id="test-request-response-data">
                        <h2>Request and Response</h2>
                        <div>`;
            if (typeof metaData !== 'undefined'){
              var requestHeaders = [];
              requestHeaders.push(metaData.req.method + ' ' + metaData.req.url + ' HTTP/' + metaData.req.httpVersion);
              Object.keys(metaData.req.headers).forEach(function(i){
                requestHeaders.push(i.replace(/\b\w/g, l => l.toUpperCase()) + ': ' + metaData.req.headers[i]);
              });

              reqresData += `
                          <dl>
                            <dt>Request</dt>
                            <dd><pre>${preSafe(requestHeaders.join("\n"))}</pre></dd>

                            <dt>Response</dt>
                            <dd><pre>${preSafe(JSON.stringify(metaData.res.headers)).slice(1, -1)}</pre></dd>
                          </dl>`;
            }
            if (typeof data !== 'undefined'){
              reqresData += `
                            <p>Created <code><a href="${notificationIRI}">${notificationIRI}</a></code>:</p>
                            <pre>${data}</pre>`;
            }
            reqresData += `
                        </div>
                    </section>`;
          }
        }
        break;
    }
    // XXX: Not useful at the moment
    // if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
    //   res.status(304);
    //   res.end();
    // }

    var outputData = `<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta charset="utf-8" />
        <title>LDN Discovery Test</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="${req.getRootUrl()}/media/css/ldntests.css" media="all" rel="stylesheet" />
    </head>

    <body about="" prefix="${prefixesRDFa}" typeof="schema:CreativeWork sioc:Post prov:Entity">
        <main>
            <article about="" typeof="schema:Article">
                <h1 property="schema:name">LDN Discovery Test</h1>

                <div id="content">
                    <section>
                        <h2>Discover Inbox</h2>
                        <div>
${discoverInboxHTML}
                        </div>
                    </section>
${(typeof reqresData !== 'undefined' && reqresData.length > 0) ? reqresData : ''}
${(typeof results !== 'undefined' && 'test-sender-report-html' in results) ? results['test-sender-report-html'] : ''}
                </div>
            </article>
        </main>
    </body>
</html>
`;

    var fromContentType = 'text/html';
    var toContentType = req.requestedType;

    var baseURL = getBaseURL(req.getUrl());
    var base = baseURL.endsWith('/') ? baseURL : baseURL + '/';
    var basePath = config.basePath.endsWith('/') ? config.basePath : '';

    var sendHeaders = function(outputData, contentType) {
      var linkRelations = ['<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"'];
      if(req.originalUrl == '/discover-inbox-link-header'){
        linkRelations.push('<' + base + basePath + 'inbox-compacted/>; rel="http://www.w3.org/ns/ldp#inbox"');
      }
      if(req.originalUrl.startsWith('/target/')){
        linkRelations.push('<' + inboxIRI + '>; rel="http://www.w3.org/ns/ldp#inbox"');
      }
      res.set('Link', linkRelations);
      res.set('Content-Type', contentType +';charset=utf-8');
      res.set('Content-Length', Buffer.byteLength(outputData, 'utf-8'));
      res.set('ETag', etag(outputData));
      // res.set('Last-Modified', stats.mtime);
      res.set('Vary', 'Origin');
      res.set('Allow', 'GET, HEAD, OPTIONS');
    }

    if(req.accepts(['text/html', 'application/xhtml+xml'])){
      sendHeaders(outputData, 'text/html');
      res.status(200);
      res.send(outputData);
      return next();
    }
    else {
      var options = { 'subjectURI': base };
      serializeData(outputData, fromContentType, toContentType, options).then(
        function(transformedData){
          switch(toContentType) {
            case 'application/ld+json':
              var x = JSON.parse(transformedData);
              x[0]["@context"] = ["http://www.w3.org/ns/ldp"];
              transformedData = JSON.stringify(x);
              break;
            default:
              break;
          }

          outputData = (fromContentType != toContentType) ? transformedData : outputData;
// console.log(outputData);
          sendHeaders(outputData, req.requestedType);

          switch(req.method) {
            case 'GET': default:
              res.status(200);
              res.send(outputData);
              break;
            case 'HEAD':
              res.status(200);
              res.send();
              break;
            case 'OPTIONS':
              res.status(204);
              break;
          }

          res.end();
          return next();
        },
        function(reason){
          res.status(500);
          res.end();
          return next();
        }
      );
    }
}


function testConsumer(req, res, next){
// console.log(req.requestedPath);
// console.log(req);

  switch(req.method){
    case 'GET':
      if(!req.accepts(['text/html', 'application/xhtml+xml', '*/*'])) {
        res.status(406);
        res.end();
        return next();
      }

      var data = getTestConsumerHTML(req);

      if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
        res.status(304);
        res.end();
        break;
      }

      res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
      res.set('Content-Type', 'text/html;charset=utf-8');
      res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
      res.set('ETag', etag(data));
      res.set('Vary', 'Origin');
      res.set('Allow', 'GET, POST');
      res.status(200);
      res.send(data);
      return next();
      break;

    case 'POST':
      var testConsumerPromises = [];
      var initTest = {
         '1': checkDiscoverInboxLinkHeader
        ,'2': checkDiscoverInboxRDFBody
        ,'3': checkDiscoverNotificationJSONLDCompacted
        ,'4': checkDiscoverNotificationJSONLDExpanded
        ,'5': checkNotificationAnnounce
        ,'6': checkNotificationChangelog
        ,'7': checkNotificationCitation
        ,'8': checkNotificationAssessing
        ,'9': checkNotificationComment
        ,'10':checkNotificationRSVP
      };

      if(req.body['test-consumer-discover-inbox-link-header']
        || req.body['test-consumer-discover-inbox-rdf-body']
        || req.body['test-consumer-inbox-compacted']
        || req.body['test-consumer-inbox-expanded']
        || req.body['test-inbox-compacted-announce']
        || req.body['test-inbox-compacted-changelog']
        || req.body['test-inbox-compacted-citation']
        || req.body['test-inbox-expanded-assessing']
        || req.body['test-inbox-expanded-comment']
        || req.body['test-inbox-expanded-rsvp']) {
        Object.keys(initTest).forEach(function(id) {
          testConsumerPromises.push(initTest[id](req));
        });

        Promise.all(testConsumerPromises)
          .then((results) => {
// console.dir(results);
            var resultsData = {};
            results.forEach(function(r){
              Object.assign(resultsData, r['consumer']);
            });
// console.dir(resultsData);

            var reportHTML = getTestReportHTML(resultsData, 'consumer');
            var test = {'url': 'TODO: ' };
            test['implementationType'] = 'Consumer';
            test['results'] = resultsData;
// console.log(test);
            resultsData['test-consumer-report-html'] = testResponse(req, test, reportHTML);

            var data = getTestConsumerHTML(req, resultsData);
// console.log(data);

            res.set('Content-Type', 'text/html;charset=utf-8');
            res.set('Allow', 'GET, POST');
            res.status(200);
            res.send(data);
            res.end();
            return next();
          })
          .catch((e) => {
            console.log('--- catch ---');
            console.log(e);
            res.end();
            return next();
          });
        }
      break;

    default:
      res.status(405);
      res.set('Allow', 'GET, POST');
      res.end();
      return next();
      break;
  }
}


function checkDiscoverInboxLinkHeader(req){
  var testResults = { 'consumer': {} };
  testResults['consumer']['checkDiscoverInboxLinkHeader'] = { 'code': 'earl:inapplicable', 'message': '' };
  var value = req.body['test-consumer-discover-inbox-link-header'];
  if(typeof value === 'undefined'){ return Promise.resolve(testResults); }
  value = value.trim();

  var inbox = getExternalBaseURL(req.getUrl()) + 'inbox-compacted/';

  if(value.length > 0 && value == inbox){
    testResults['consumer']['checkDiscoverInboxLinkHeader'] = { 'code': 'earl:passed', 'message': '' };
  }
  else {
    testResults['consumer']['checkDiscoverInboxLinkHeader'] = { 'code': 'earl:failed', 'message': 'Check the Inbox URL again. Make sure to only include the URL.' };
  }
  return Promise.resolve(testResults);
}

function checkDiscoverInboxRDFBody(req){
  var testResults = { 'consumer': {} };
  testResults['consumer']['checkDiscoverInboxRDFBody'] = { 'code': 'earl:inapplicable', 'message': '' };
  var value = req.body['test-consumer-discover-inbox-rdf-body'];
  if(typeof value === 'undefined'){ return Promise.resolve(testResults); }
  value = value.trim();
  var inbox = getExternalBaseURL(req.getUrl()) + 'inbox-expanded/';

  if(value.length > 0 && value == inbox){
    testResults['consumer']['checkDiscoverInboxRDFBody'] = { 'code': 'earl:passed', 'message': '' };
  }
  else {
    testResults['consumer']['checkDiscoverInboxRDFBody'] = { 'code': 'earl:failed', 'message': 'Check the Inbox URL again. Make sure to only include the URL.' };
  }
  return Promise.resolve(testResults);
}

function checkDiscoverNotificationJSONLDCompacted(req){
  var testResults = { 'consumer': {} };
  testResults['consumer']['checkDiscoverNotificationJSONLDCompacted'] = { 'code': 'earl:inapplicable', 'message': '' };
  var value = req.body['test-consumer-inbox-compacted'];
  if(typeof value === 'undefined'){ return Promise.resolve(testResults); }
  value = value.trim().split(' ');
  var inbox = getExternalBaseURL(req.getUrl()) + 'inbox-compacted/';
  var notifications = [inbox+'announce', inbox+'changelog', inbox+'citation'];

  testResults['consumer']['checkDiscoverNotificationJSONLDCompacted'] = { 'code': 'earl:failed', 'message': 'Expecting ' + notifications.length + ' notifications. Make sure to separate by a space.' };

  var message, found = 0;
  if(value.length == 3){
    var check = true;
    value.forEach(function(i){
      if(notifications.indexOf(i) < 0){
        check = false;
      }
      else {
        found++;
      }
    });

    if(check) {
      testResults['consumer']['checkDiscoverNotificationJSONLDCompacted'] = { 'code': 'earl:passed', 'message': '' };
    }
    else {
      testResults['consumer']['checkDiscoverNotificationJSONLDCompacted'] = { 'code': 'earl:failed', 'message': 'Notifications found:' + found + '/' + notifications.length + '. Make sure to separate by a space.' };
    }
  }
  return Promise.resolve(testResults);
}


function checkDiscoverNotificationJSONLDExpanded(req){
  var testResults = { 'consumer': {} };
  testResults['consumer']['checkDiscoverNotificationJSONLDExpanded'] = { 'code': 'earl:inapplicable', 'message': '' };
  var value = req.body['test-consumer-inbox-expanded'];
  if(typeof value === 'undefined'){ return Promise.resolve(testResults); }
  value = value.trim().split(' ');
  var inbox = getExternalBaseURL(req.getUrl()) + 'inbox-expanded/';
  var notifications = [inbox+'assessing', inbox+'comment', inbox+'rsvp'];

  testResults['consumer']['checkDiscoverNotificationJSONLDExpanded'] = { 'code': 'earl:failed', 'message': 'Expecting ' + notifications.length + ' notifications. Make sure to separate by a space.' };

  var message, found = 0;
  if(value.length == 3){
    var check = true;
    value.forEach(function(i){
      if(notifications.indexOf(i) < 0){
        check = false;
      }
      else {
        found++;
      }
    });

    if(check) {
      testResults['consumer']['checkDiscoverNotificationJSONLDExpanded'] = { 'code': 'earl:passed', 'message': '' };
    }
    else {
      testResults['consumer']['checkDiscoverNotificationJSONLDExpanded'] = { 'code': 'earl:failed', 'message': 'Notifications found:' + found + '/' + notifications.length + '. Make sure to separate by a space.' };
    }
  }
  return Promise.resolve(testResults);
}

function checkNotificationAnnounce(req){
  var options = {
    'test': 'checkNotificationAnnounce',
    'data': req.body['test-inbox-compacted-announce'],
    'subject': getExternalBaseURL(req.getUrl()) + 'inbox-compacted/announce',
    'property': vocab['rdftype']['@id'],
    'object': 'https://www.w3.org/ns/activitystreams#Announce'
  };
  return checkNotification(req, options);
}

function checkNotificationChangelog(req){
  var options = {
    'test': 'checkNotificationChangelog',
    'data': req.body['test-inbox-compacted-changelog'],
    'subject': 'http://example.org/activity/804c4e7efaa828e146b4ada1c805617ffbc79dc7',
    'property': vocab['rdftype']['@id'],
    'object': 'http://www.w3.org/ns/prov#Activity'
  };
  return checkNotification(req, options);
}

function checkNotificationCitation(req){
  var options = {
    'test': 'checkNotificationCitation',
    'data': req.body['test-inbox-compacted-citation'],
    'subject': 'http://example.net/note#foo',
    'property': 'http://schema.org/citation',
    'object': 'http://example.org/article#results'
  };
  return checkNotification(req, options);
}

function checkNotificationAssessing(req){
  var options = {
    'test': 'checkNotificationAssessing',
    'data': req.body['test-inbox-expanded-assessing'],
    'subject': 'http://example.net/note',
    'property': 'http://www.w3.org/ns/oa#motivatedBy',
    'object': 'http://www.w3.org/ns/oa#assessing'
  };
  return checkNotification(req, options);
}

function checkNotificationComment(req){
  var options = {
    'test': 'checkNotificationComment',
    'data': req.body['test-inbox-expanded-comment'],
    'subject': getExternalBaseURL(req.getUrl()) + 'inbox-expanded/comment',
    'property': 'http://rdfs.org/sioc/ns#reply_of',
    'object': 'http://example.org/article'
  };
  return checkNotification(req, options);
}

function checkNotificationRSVP(req){
  var options = {
    'test': 'checkNotificationRSVP',
    'data': req.body['test-inbox-expanded-rsvp'],
    'subject': getExternalBaseURL(req.getUrl()) + 'inbox-expanded/rsvp',
    'property': 'http://schema.org/event',
    'object': 'http://example.org/event'
  };
  return checkNotification(req, options);
}

function checkNotification(req, options){
  var testResults = { 'consumer': {} };
  testResults['consumer']['checkNotification'] = { 'code': 'earl:inapplicable', 'message': '' };
  if(typeof value === 'undefined'){ return Promise.resolve(testResults); }
  value = value.trim();

  var o = {
    'contentType': 'application/ld+json',
    'subjectURI': options.subject
  }

  try { JSON.parse(options.data) }
  catch(error) {
    testResults['consumer'][options.test] = { 'code': 'earl:failed', 'message': 'Malformed JSON.' };
    return Promise.resolve(testResults);
  }

  return getGraphFromData(options.data, o).then(
    function(g){
      var matchedStatements = g.match(options.subject, options.property, options.object).toArray();
      if(matchedStatements.length == 1) {
        testResults['consumer'][options.test] = { 'code': 'earl:passed', 'message': '' };
      }
      else {
        testResults['consumer'][options.test] = { 'code': 'earl:failed', 'message': 'Tested pattern not found.' };
      }
      return Promise.resolve(testResults);
    },
    function(reason){
      testResults['consumer'][options.test] = { 'code': 'earl:failed', 'message': 'Unable to parse as JSON-LD.' };
      return Promise.resolve(testResults);
    }
  );
}


function getTestConsumerHTML(req, results){
  return `<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta charset="utf-8" />
        <title>LDN Tests for Consumers</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="${req.getRootUrl()}/media/css/ldntests.css" media="all" rel="stylesheet" />
    </head>

    <body about="" prefix="${prefixesRDFa}" typeof="schema:CreativeWork sioc:Post prov:Entity">
        <main>
            <article about="" typeof="schema:Article">
                <h1 property="schema:name">LDN Tests for Consumers</h1>

                <div id="content">
                    <section id="consumer" inlist="" rel="schema:hasPart" resource="#consumer">
                        <h2 property="schema:name">Consumer</h2>
                        <div datatype="rdf:HTML" property="schema:description">
                            <p>Run your consumer software against these tests, then submit the report below.</p>
<!--
                            <dl>
                                <dt>Tests</dt>
                                <dd>
                                    <ul>
                                      <li><a href="discover-inbox-link-header">discover-inbox-link-header</a></li>
                                      <li><a href="discover-inbox-rdf-body">discover-inbox-rdf-body</a></li>
                                      <li><a href="inbox-compacted/">inbox-compacted/</a></li>
                                      <li><a href="inbox-expanded/">inbox-expanded/</a></li>
                                      <li><a href="inbox-compacted/announce">inbox-announce/</a></li>
                                      <li><a href="inbox-compacted/changelog">inbox-changelog/</a></li>
                                      <li><a href="inbox-compacted/citation">inbox-citation/</a></li>
                                      <li><a href="inbox-expanded/assessing">inbox-expanded/assessing</a></li>
                                      <li><a href="inbox-expanded/comment">inbox-expanded/comment</a></li>
                                      <li><a href="inbox-expanded/rsvp">inbox-expanded/rsvp</a></li>
                                    </ul>
                                </dd>
                            </dl>
-->
                            <form action="" class="form-tests" id="test-consumer-report" method="post">
                                <fieldset id="test-consumer">
                                    <legend>Test Consumer</legend>
                                    <ul>
                                        <li>
                                            <p>URL of the Inbox from <a href="discover-inbox-link-header">discover-inbox-link-header</a> (in header):</p>
                                            <label for="test-consumer-discover-inbox-link-header">URL</label>
                                            <input type="text" name="test-consumer-discover-inbox-link-header" value="" placeholder="Include only the URL" />
                                        </li>
                                        <li>
                                            <p>URL of the Inbox from <a href="discover-inbox-rdf-body">discover-inbox-rdf-body</a> (in RDF body):</p>
                                            <label for="test-consumer-discover-inbox-rdf-body">URL</label>
                                            <input type="text" name="test-consumer-discover-inbox-rdf-body" value="" placeholder="Include only the URL" />
                                        </li>
                                        <li>
                                            <p>URLs of the notifications in <a href="discover-inbox-link-header">target</a>'s Inbox (JSON-LD compacted):</p>
                                            <label for="test-consumer-inbox-compacted">URLs</label>
                                            <input type="text" name="test-consumer-inbox-compacted" value="" placeholder="Separated by a space" />
                                        </li>
                                        <li>
                                            <p>URLs of the notifications in <a href="discover-inbox-rdf-body">target</a>'s Inbox (JSON-LD expanded):</p>
                                            <label for="test-consumer-inbox-expanded">URLs</label>
                                            <input type="text" name="test-consumer-inbox-expanded" value="" placeholder="Separated by a space" />
                                        </li>
                                        <li>
                                          <label for="test-inbox-compacted-announce">Contents of the <samp>announce</samp> notification discovered from <a href="discover-inbox-link-header">target</a>'s Inbox</label>
                                          <textarea name="test-inbox-compacted-announce" cols="80" rows="3"></textarea>
                                        </li>
                                        <li>
                                          <label for="test-inbox-compacted-changelog">Contents of the <samp>changelog</samp> notification discovered from <a href="discover-inbox-link-header">target</a>'s Inbox</label>
                                          <textarea name="test-inbox-compacted-changelog" cols="80" rows="3"></textarea>
                                        </li>
                                        <li>
                                          <label for="test-inbox-compacted-citation">Contents of the <samp>citation</samp> notification discovered from <a href="discover-inbox-link-header">target</a>'s Inbox</label>
                                          <textarea name="test-inbox-compacted-citation" cols="80" rows="3"></textarea>
                                        </li>
                                        <li>
                                          <label for="test-inbox-expanded-assessing">Contents of the <samp>assessing</samp> notification discovered from <a href="discover-inbox-rdf-body">target</a>'s Inbox</label>
                                          <textarea name="test-inbox-expanded-assessing" cols="80" rows="3"></textarea>
                                        </li>
                                        <li>
                                          <label for="test-inbox-expanded-comment">Contents of the <samp>comment</samp> notification discovered from <a href="discover-inbox-rdf-body">target</a>'s Inbox</label>
                                          <textarea name="test-inbox-expanded-comment" cols="80" rows="3"></textarea>
                                        </li>
                                        <li>
                                          <label for="test-inbox-expanded-rsvp">Contents of the <samp>rsvp</samp> notification discovered from <a href="discover-inbox-rdf-body">target</a>'s Inbox</label>
                                          <textarea name="test-inbox-expanded-rsvp" cols="80" rows="3"></textarea>
                                        </li>
                                    </ul>
                                    <input type="hidden" name="test-implementation" value="consumer" />
                                    <input type="submit" value="Submit" />
                                </fieldset>
                            </form>
${(typeof results !== 'undefined' && 'test-consumer-report-html' in results) ? results['test-consumer-report-html'] : ''}
                        </div>
                    </section>
                </div>
            </article>
        </main>
    </body>
</html>
`;

}


module.exports = {
ldnTests
}
