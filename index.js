var fs = require('fs');
var etag = require('etag');
var uuid = require('node-uuid');
var btoa = require("btoa");
var atob = require("atob");
var mayktso = require('mayktso');

var config = mayktso.config();
mayktso.init({'config': config, 'omitRoutes': ['/media', '/sender', '/target/', '/receiver', '/consumer', '/discover-inbox-rdf-body', '/discover-inbox-link-header', '/inbox-compacted/$', '/inbox-expanded/$', '/inbox-sender/$', '/send-report', '/summary']});

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
  var fileNameSuffix = '';
  if(req.query && 'discovery' in req.query && req.query['discovery'].length > 0) {
    fileNameSuffix = '.' + req.query['discovery'];
  }

  mayktso.handleResource(req, res, next, { jsonld: { profile: 'http://www.w3.org/ns/json-ld#expanded' }, storeMeta: true, allowSlug: true, fileNameSuffix: fileNameSuffix  });
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
var resStatus = mayktso.resStatus;

var ldnTestsVocab = {
  "earlAssertion": { "@id": "http://www.w3.org/ns/earl#Assertion", "@type": "@id" },
  "earlinfo": { "@id": "http://www.w3.org/ns/earl#info" },
  "earloutcome": { "@id": "http://www.w3.org/ns/earl#outcome", "@type": "@id" },
  "earlsubject": { "@id": "http://www.w3.org/ns/earl#subject", "@type": "@id" },
  "earlresult": { "@id": "http://www.w3.org/ns/earl#result", "@type": "@id" },
  "earltest": { "@id": "http://www.w3.org/ns/earl#test", "@type": "@id" },
  "qbObservation": { "@id": "http://purl.org/linked-data/cube#Observation", "@type": "@id" },
  "doapProject": { "@id": "http://usefulinc.com/ns/doap#Project", "@type": "@id" },
  "doapname": { "@id": "http://usefulinc.com/ns/doap#name" }
}
Object.assign(vocab, ldnTestsVocab);

var ldnTests = {
  'sender': {
    'testSenderHeaderDiscovery': {
      'uri': 'https://www.w3.org/TR/ldn/#test-sender-header-discovery',
      'description': 'Inbox discovery (<code>Link</code> header).',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testSenderHeaderPostRequest': {
      'uri': 'https://www.w3.org/TR/ldn/#test-sender-header-post-request',
      'description': 'Makes <code>POST</code> requests (<code>Link</code> header).',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testSenderHeaderPostContentTypeJSONLD': {
      'uri': 'https://www.w3.org/TR/ldn/#test-sender-header-post-content-type-json-ld',
      'description': '<code>POST</code> includes <code>Content-Type: application/ld+json</code> (<code>Link</code> header).',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testSenderHeaderPostValidJSONLD': {
      'uri': 'https://www.w3.org/TR/ldn/#test-sender-header-post-valid-json-ld',
      'description': '<code>POST</code> payload is JSON-LD (<code>Link</code> header).',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },

    'testSenderBodyDiscovery': {
      'uri': 'https://www.w3.org/TR/ldn/#test-sender-body-discovery',
      'description': 'Inbox discovery (RDF body).',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testSenderBodyPostRequest': {
      'uri': 'https://www.w3.org/TR/ldn/#test-sender-body-post-request',
      'description': 'Makes <code>POST</code> requests (RDF body).',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testSenderBodyPostContentTypeJSONLD': {
      'uri': 'https://www.w3.org/TR/ldn/#test-sender-body-post-content-type-json-ld',
      'description': '<code>POST</code> includes <code>Content-Type: application/ld+json</code> (RDF body).',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testSenderBodyPostBodyJSONLD': {
      'uri': 'https://www.w3.org/TR/ldn/#test-sender-body-post-valid-json-ld',
      'description': '<code>POST</code> payload is JSON-LD (RDF body).',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    }
  },
  'consumer': {
    'testConsumerHeaderDiscovery': {
      'uri': 'https://www.w3.org/TR/ldn/#test-consumer-header-discovery',
      'description': 'Inbox discovery (<code>Link</code> header).',
      'earl:mode': 'earl:semiAuto',
      'requirement': 'MUST'
    },
    'testConsumerBodyDiscovery': {
      'uri': 'https://www.w3.org/TR/ldn/#test-consumer-body-discovery',
      'description': 'Inbox discovery (RDF body).',
      'earl:mode': 'earl:semiAuto',
      'requirement': 'MUST'
    },
    'testConsumerListingJSONLDCompacted': {
      'uri': 'https://www.w3.org/TR/ldn/#test-consumer-listing-json-ld-compacted',
      'description': 'Notification discovery from Inbox using JSON-LD compacted form.',
      'earl:mode': 'earl:semiAuto',
      'requirement': 'MUST'
    },
    'testConsumerListingJSONLDExpanded': {
      'uri': 'https://www.w3.org/TR/ldn/#test-consumer-listing-json-ld-expanded',
      'description': 'Notification discovery from Inbox using JSON-LD expanded form.',
      'earl:mode': 'earl:semiAuto',
      'requirement': 'MUST'
    },
    'testConsumerNotificationAnnounce': {
      'uri': 'https://www.w3.org/TR/ldn/#test-consumer-notification-announce',
      'description': 'Contents of the <samp>announce</samp> notification.',
      'earl:mode': 'earl:semiAuto',
      'requirement': 'MAY'
    },
    'testConsumerNotificationChangelog': {
      'uri': 'https://www.w3.org/TR/ldn/#test-consumer-notification-changelog',
      'description': 'Contents of the <samp>changelog</samp> notification.',
      'earl:mode': 'earl:semiAuto',
      'requirement': 'MAY'
    },
    'testConsumerNotificationCitation': {
      'uri': 'https://www.w3.org/TR/ldn/#test-consumer-notification-citation',
      'description': 'Contents of the <samp>citation</samp> notification.',
      'earl:mode': 'earl:semiAuto',
      'requirement': 'MAY'
    },
    'testConsumerNotificationAssessing': {
      'uri': 'https://www.w3.org/TR/ldn/#test-consumer-notification-assessing',
      'description': 'Contents of the <samp>assessing</samp> notification.',
      'earl:mode': 'earl:semiAuto',
      'requirement': 'MAY'
    },
    'testConsumerNotificationComment': {
      'uri': 'https://www.w3.org/TR/ldn/#test-consumer-notification-comment',
      'description': 'Contents of the <samp>comment</samp> notification.',
      'earl:mode': 'earl:semiAuto',
      'requirement': 'MAY'
    },
    'testConsumerNotificationRSVP': {
      'uri': 'https://www.w3.org/TR/ldn/#test-consumer-notification-rsvp',
      'description': 'Contents of the <samp>rsvp</samp> notifications.',
      'earl:mode': 'earl:semiAuto',
      'requirement': 'MAY'
    }
  },
  'receiver': {

    'testReceiverPostResponse': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-post-response',
      'description': 'Accepts <code>POST</code> requests.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testReceiverPostCreated': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-post-created',
      'description': 'Responds to <code>POST</code> requests with <code>Content-Type: application/ld+json</code> with status code <code>201 Created</code> or <code>202 Accepted</code>.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testReceiverPostLocation': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-post-location',
      'description': 'Returns a <code>Location</code> header in response to successful <code>POST</code> requests.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testReceiverPostLinkProfile': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-post-link-profile',
      'description': 'Succeeds when the content type includes a <code>profile</code> parameter.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },

    'testReceiverGetResponse': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-get-response',
      'description': 'Returns JSON-LD on <code>GET</code> requests.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testReceiverGetLDPContains': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-get-ldp-contains',
      'description': 'Lists notification URIs with <code>ldp:contains</code>.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testReceiverGetNotificationsJSONLD': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-get-notifications-json-ld',
      'description': 'Notifications are available as JSON-LD.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testReceiverGetNotificationsRDFSource': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-get-notifications-rdf-source',
      'description': 'When requested with no <code>Accept</code> header or <code>*/*</code>, notifications are still returned as RDF.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MUST'
    },
    'testReceiverOptionsResponse': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-options-response',
      'description': 'Accepts <code>OPTIONS</code> requests.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MAY'
    },
    'testReceiverOptionsAcceptPost': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-options-accept-post',
      'description': 'Advertises acceptable content types with <code>Accept-Post</code> in response to <code>OPTIONS</code> request.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MAY',
      'dependency': 'testReceiverOptionsResponse'
    },
    'testReceiverOptionsAcceptPostContainsJSONLD': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-options-accept-post-contains-json-ld',
      'description': '<code>Accept-Post</code> includes <code>application/ld+json</code>.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MAY',
      'dependency': 'testReceiverOptionsResponse'
    },
    'testReceiverPostResponseConstraintsUnmet': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-post-response-contraints-unmet',
      'description': 'Fails to process notifications if implementation-specific constraints are not met.',
      'earl:mode': 'earl:automatic',
      'requirement': 'SHOULD'
    },
    'testReceiverGetNotificationsLimited': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-get-notifications-limited',
      'description': 'Restricts list of notification URIs (eg. according to access control).',
      'earl:mode': 'earl:semiAuto',
      'requirement': 'MAY'
    },
    'testReceiverGetLDPContainer': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-get-ldp-container',
      'description': 'Inbox has type <code>ldp:Container</code>.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MAY'
    },
    'testReceiverGetLDPConstrainedBy': {
      'uri': 'https://www.w3.org/TR/ldn/#test-receiver-get-ldp-constrained-by',
      'description': 'Advertises constraints with <code>ldp:constrainedBy</code>.',
      'earl:mode': 'earl:automatic',
      'requirement': 'MAY'
    }
  }
}
// 'testReceiverHeadResponse': {
//   'description': 'Accepts <code>HEAD</code> requests.',
//   'earl:mode': 'earl:automatic'
// },

// Object.keys(ldnTests).forEach(function(i){
//   console.log(Object.keys(ldnTests[i]));
// });


function testSender(req, res, next){
// console.log(req.requestedPath);
// console.log(req);

  switch(req.method){
    case 'GET':
      if(!req.requestedType){
        resStatus(res, 406);
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
      res.end();
      break;

    case 'POST':

      break;

    default:
      res.status(405);
      res.set('Allow', 'GET, POST');
      res.end();
      break;
  }

  return;
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
              <p>Run your sender software to <em>both</em> of these targets which advertise their inboxes through <code>Link</code> header and RDF body respectively:</p>

              <ul>
                <li><code>${targetIRI}?discovery=link-header</code></li>
                <li><code>${targetIRI}?discovery=rdf-body</code></li>
              </ul>

              <p>To see the test results and to submit a report go to: <code><a href="${targetIRI}">${targetIRI}</a></code>.</p>
              <p>Reports will be submitted to an <a about="" rel="ldp:inbox" href="reports/">inbox</a> and can be retrieved.</p>
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
        resStatus(res, 406);
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
      res.end();
      break;

    case 'POST':
      var testReceiverPromises = [];
      var initTest = { '1': testReceiverOptionsResponse, '2': testReceiverPostResponse, '3': testReceiverGetResponse };

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
            test['implementationType'] = 'receiver';
            test['results'] = resultsData;

            resultsData['test-receiver-report-html'] = testResponse(req, test, reportHTML);

            var data = getTestReceiverHTML(req, resultsData);
// console.log(data);

            res.set('Content-Type', 'text/html;charset=utf-8');
            res.set('Allow', 'GET, POST');
            res.status(200);
            res.send(data);
            res.end();
          })
          .catch((e) => {
            console.log('--- catch ---');
            console.log(e);
            res.end();
          });
      }
      break;

    default:
      res.status(405);
      res.set('Allow', 'GET, POST');
      res.end();
      break;
  }

  return;
}


function testReceiverOptionsResponse(req){
  var testResults = { 'receiver': {} };
  var headers = {};
  headers['Content-Type'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
  var url = req.body['test-receiver-url'];
// console.log('testReceiverOptions: ' + url);
  return getResourceOptions(url, headers).then(
    function(response){
        var acceptPost = response.xhr.getResponseHeader('Accept-Post');
        testResults['receiver']['testReceiverOptionsResponse'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' };
        if(acceptPost){
          testResults['receiver']['testReceiverOptionsAcceptPost'] = { 'earl:outcome': 'earl:passed', 'earl:info': '<code>Accept-Post: ' + acceptPost + '</code>' };

          var acceptPosts = acceptPost.split(',');
          testResults['receiver']['testReceiverOptionsAcceptPostContainsJSONLD'] = { 'earl:outcome': 'earl:failed', 'earl:info': '<code>Accept-Post: ' + acceptPost + '</code>' };
          acceptPosts.forEach(function(i){
            var m = i.trim();
            if(m == 'application/ld+json' || m == '*/*'){
              testResults['receiver']['testReceiverOptionsAcceptPostContainsJSONLD'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' };
            }
          })
        }
        else {
          testResults['receiver']['testReceiverOptionsAcceptPost'] = { 'earl:outcome': 'earl:failed', 'earl:info': '<code>Accept-Post: ' + acceptPost + '</code>' };
        }
      return Promise.resolve(testResults);
    },
    function(reason){
      testResults['receiver']['testReceiverOptionsResponse'] = { 'earl:outcome': 'earl:inapplicable', 'earl:info': '<code>HTTP ' + reason.xhr.status + '</code>' };
      return Promise.resolve(testResults);
    });
}

function testReceiverHeadResponse(req){
  var testResults = { 'receiver': {} };
  var headers = {};
  headers['Content-Type'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
  var url = req.body['test-receiver-url'];
// console.log('testReceiverHeadResponse: ' + url);
  return getResourceHead(url, headers).then(
    function(response){
      testResults['receiver']['testReceiverHeadResponse'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' };
      return Promise.resolve(testResults);
    },
    function(reason){
      testResults['receiver']['testReceiverHeadResponse'] = { 'earl:outcome': 'earl:inapplicable', 'earl:info': '<code>HTTP ' + reason.xhr.status + '</code>' };
      return Promise.resolve(testResults);
    });
}

function testReceiverGetResponse(req){
  var testResults = { 'receiver': {} };
  var headers = {};
  headers['Accept'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
  var url = req.body['test-receiver-url'];
// console.log('testReceiverGetResponse: ' + url);
  return getResource(url, headers).then(
    function(response){
// console.log(response);
      testResults['receiver']['testReceiverGetNotificationsLimited'] = { 'earl:outcome': 'earl:inapplicable', 'earl:info': '' };
      testResults['receiver']['testReceiverGetLDPContains'] = { 'earl:outcome': 'earl:untested', 'earl:info': '' };

      if('test-receiver-get-notifications-limited' in req.body){
        testResults['receiver']['testReceiverGetNotificationsLimited'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' };
      }

      var linkHeaders = parseLinkHeader(response.xhr.getResponseHeader('Link'));
      var rdftypes = [];
      var ldpContainerFound = false;

      testResults['receiver']['testReceiverGetLDPContainer'] = { 'earl:outcome': 'earl:inapplicable', 'earl:info': 'Not found.' };
      testResults['receiver']['testReceiverGetLDPConstrainedBy'] = { 'earl:outcome': 'earl:inapplicable', 'earl:info': 'Not found.' };

      if('type' in linkHeaders && (linkHeaders['type'].indexOf(vocab.ldpcontainer["@id"]) || linkHeaders['type'].indexOf(vocab.ldpbasiccontainer["@id"]))){
        ldpContainerFound = true;

        linkHeaders['type'].forEach(function(url){
          if(url == vocab.ldpcontainer["@id"] || url == vocab.ldpbasiccontainer["@id"]) {
            rdftypes.push('<a href="' + url + '">' + url + '</a>');
          }
        });

        testResults['receiver']['testReceiverGetLDPContainer'] = { 'earl:outcome': 'earl:passed', 'earl:info': 'Found in <code>Link</code> header: ' + rdftypes.join(', ') };
      }

      if (vocab['ldpconstrainedBy']['@id'] in linkHeaders && linkHeaders[vocab['ldpconstrainedBy']['@id']].length > 0) {
        var constrainedBys = [];
        linkHeaders[vocab['ldpconstrainedBy']['@id']].forEach(function(url){
          constrainedBys.push('<a href="' + url + '">' + url + '</a>');
        });

        testResults['receiver']['testReceiverGetLDPConstrainedBy'] = { 'earl:outcome': 'earl:passed', 'earl:info': 'Found: ' + constrainedBys.join(', ') };
      }

      var data = response.xhr.responseText;
      try {
        JSON.parse(data);
      }
      catch(e){
        testResults['receiver']['testReceiverGetResponse'] = { 'earl:outcome': 'earl:failed', 'earl:info': '<code>HTTP '+ response.xhr.status + '</code> received but it had an empty body (invalid JSON-LD). Consider returning <code>HTTP 200</code> with <code>{ "@id": "", "http://www.w3.org/ns/ldp#contains": [] }</code>, or an <code>HTTP 4xx</code> if that was the real intention, and check the checkbox for <q>Receiver should reject this notification</q> in the test form.' };
        return Promise.resolve(testResults);
      }
      var contentType = response.xhr.getResponseHeader('Content-Type') || undefined;
// console.log(contentType);
      if(typeof contentType == undefined){
          testResults['receiver']['testReceiverGetResponse'] = { 'earl:outcome': 'earl:failed', 'earl:info': 'No <code>Content-Type</code>. Inbox can not be parsed as <code>' + headers['Accept'] + '</code>.' };
          return Promise.resolve(testResults);
      }
      else if(contentType.split(';')[0].trim() != headers['Accept']) {
          testResults['receiver']['testReceiverGetResponse'] = { 'earl:outcome': 'earl:failed', 'earl:info': '<code>Content-Type: ' + contentType + '</code> returned. Inbox can not be parsed as <code>' + headers['Accept'] + '</code>.'};
          return Promise.resolve(testResults);
      }
      else {
        testResults['receiver']['testReceiverGetResponse'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' };
        var options = {
          'contentType': 'application/ld+json',
          'subjectURI': url
        }
// console.log(data);
// console.log(options);
        return getGraphFromData(data, options).then(
          function(g) {
            var s = SimpleRDF(vocab, options['subjectURI'], g, RDFstore).child(options['subjectURI']);
// console.log(s.iri().toString());

            //These checks are extra, not required by the specification
            var types = s.rdftype;
            var resourceTypes = [];
            types._array.forEach(function(type){
              resourceTypes.push(type);
            });

            if(!ldpContainerFound) {
              rdfTypes = [];
              if(resourceTypes.indexOf(vocab.ldpcontainer["@id"]) > -1 || resourceTypes.indexOf(vocab.ldpbasiccontainer["@id"]) > -1) {
                resourceTypes.forEach(function(url){
                  if(url == vocab.ldpcontainer["@id"] || url == vocab.ldpbasiccontainer["@id"]) {
                    rdftypes.push('<a href="' + url + '">' + url + '</a>');
                  }
                });

                testResults['receiver']['testReceiverGetLDPContainer'] = { 'earl:outcome': 'earl:passed', 'earl:info': 'Found in body: ' + rdftypes.join(', ') };
              }
            }

            var notifications = [];
            s.ldpcontains.forEach(function(resource) {
              notifications.push(resource.toString());
            });

            if(notifications.length > 0) {
              var notificationsNoun = (notifications.length == 1) ? 'notification' : 'notifications';
              testResults['receiver']['testReceiverGetLDPContains'] = { 'earl:outcome': 'earl:passed', 'earl:info': 'Found ' + notifications.length + ' ' + notificationsNoun + '.' };

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

                      switch(this.status){
                        default:
                          resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'earl:outcome': 'earl:failed', 'earl:info': anchor + ': HTTP status ' + this.status });
                          break;
                        case 401: case 403:
                          resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'earl:outcome': 'earl:untested', 'earl:info': anchor + ': HTTP status ' + this.status });
                          break;
                        case 200:
                          var data = this.responseText;
                          var cT = this.getResponseHeader('Content-Type');

                          if(typeof cT === 'undefined' || !cT) {
                            resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'earl:outcome': 'earl:failed', 'earl:info': '<code>Content-Type</code> is missing or empty.' });
                            return;
                          }
                          var contentType = cT.split(';')[0].trim();

                          if(acceptValue == 'application/ld+json' && contentType != 'application/ld+json') {
                            resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'earl:outcome': 'earl:failed', 'earl:info': anchor + ': <code>Accept: ' + acceptValue + '</code> != <code>Content-Type: ' + cT + '</code>' });
                          }
                          else {
                            var options = { 'subjectURI': '_:ldn' }
                            var codeAccept = (acceptValue == '') ? 'No <code>Accept</code>' : '<code>Accept: ' + acceptValue + '</code>';
                            serializeData(data, contentType, 'application/ld+json', options).then(
                              function(i){
                                resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'earl:outcome': 'earl:passed', 'earl:info': anchor + ': ' + codeAccept + ' => <code>Content-Type: ' + cT + '</code> <em>can</em> be serialized as JSON-LD' });
                              },
                              function(reason){
                                resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'earl:outcome': 'earl:failed', 'earl:info': anchor + ': ' + codeAccept + ' => <code>Content-Type: ' + cT + '</code> <em>can not</em> be serialized as JSON-LD' });
                              }
                            );
                          }
                          break;
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
                      if (r['earl:outcome'] == 'earl:failed') { codeJSONLD = 'earl:failed'; }
                      notificationStateJSONLD.push(r['earl:info']);
                    }
                    else {
                      if (r['earl:outcome'] == 'earl:failed') { codeRDFSource = 'earl:failed'; }
                      notificationStateRDFSource.push(r['earl:info']);
                    }
                    notificationState.push(r['earl:info']);
                  });
                  notificationStateJSONLD = notificationStateJSONLD.join(', ');
                  notificationStateRDFSource = notificationStateRDFSource.join(', ');

                  testResults['receiver']['testReceiverGetNotificationsJSONLD'] = { 'earl:outcome': codeJSONLD, 'earl:info': notificationStateJSONLD };
                  testResults['receiver']['testReceiverGetNotificationsRDFSource'] = { 'earl:outcome': codeRDFSource, 'earl:info': notificationStateRDFSource };

                  return Promise.resolve(testResults);
                })
                .catch((e) => {
                  console.log('--- catch: notificationResponses ---');
                  console.log(e);
                });
            }
            else {
              testResults['receiver']['testReceiverGetLDPContains'] = { 'earl:outcome': 'earl:inapplicable', 'earl:info': 'Did not find <code>ldp:contains</code>. It may be because there are no notifications (yet or available?). Doublecheck: <samp>inboxURL ldp:contains notificationURL</samp> exists' };
              return Promise.resolve(testResults);
            }
          },
          function(reason){
// console.log(reason);
            testResults['receiver']['testReceiverGetResponse'] = { 'earl:outcome': 'earl:failed', 'earl:info': 'Inbox can not be parsed as <code>' + headers['Accept'] + '</code>.' };
            return Promise.resolve(testResults);
          });
      }
    },
    function(reason){
// console.log(reason);
      testResults['receiver']['testReceiverGetResponse'] = { 'earl:outcome': 'earl:failed', 'earl:info': '<code>HTTP '+ reason.xhr.status + '</code>, <code>Content-Type: ' + reason.xhr.getResponseHeader('Content-Type') + '</code>' };
      return Promise.resolve(testResults);
    });
}



function testReceiverPostResponse(req){
  var testResults = { 'receiver': {} };
  var headers = {};
  var url = req.body['test-receiver-url'];
  headers['Content-Type'] = 'application/ld+json; profile="http://example.org/profile"; charset=utf-8';
  headers['Slug'] = uuid.v1() + '.jsonld';
  var data = ('test-receiver-data' in req.body && req.body['test-receiver-data'].length > 0) ? req.body['test-receiver-data'] : '';
// console.log('testReceiverGet: ' + url);
  return postResource(url, headers['Slug'], data, headers['Content-Type']).then(
    function(response){
// console.log(response);
      // POST requests are supported, with and without profiles
      var status = '<code>HTTP ' + response.xhr.status + '</code>';
      testResults['receiver']['testReceiverPostResponse'] = { 'earl:outcome': 'earl:passed', 'earl:info': status };
      testResults['receiver']['testReceiverPostLinkProfile'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' };
      testResults['receiver']['testReceiverPostResponseConstraintsUnmet'] = { 'earl:outcome': 'earl:inapplicable', 'earl:info': '' };

      // If 201 or 202
      if(response.xhr.status == 201 || response.xhr.status == 202) {
        // If 'reject' was ticked, creating was wrong, fail
        if('test-receiver-reject' in req.body){
          testResults['receiver']['testReceiverPostCreated'] = { 'earl:outcome' : 'earl:failed', 'earl:info' : 'Payload did not meet constraints, but the receiver indicated success (' + status + ')' };
          testResults['receiver']['testReceiverPostResponseConstraintsUnmet'] = { 'earl:outcome': 'earl:failed', 'earl:info': '' };
          return Promise.resolve(testResults);

        // Otherwise, pass
        }
        else{
          testResults['receiver']['testReceiverPostCreated'] = { 'earl:outcome': 'earl:passed', 'earl:info': status };

          var location = response.xhr.getResponseHeader('Location');
          // If 201, check Location header
          if(response.xhr.status == 201){
            if(location){
              var url = location;
              if(location.toLowerCase().slice(0,4) != 'http') {
                //TODO: baseURL for response.xhr.getResponseHeader('Location') .. check response.responseURL?
                url = response.xhr._url.href + location;
                if(location[0] == '/'){
                  var port = (response.xhr._url.port) ? ':' + response.xhr._url.port : '';
                  url = response.xhr._url.protocol + '//' + response.xhr._url.hostname + port + location;
                }
              }

              var headers = {};
              headers['Accept'] = 'application/ld+json';

              return getResource(url, headers).then(
                //Maybe use checkPostLocationRetrieveable
                function(i){
// console.log(i);
                  testResults['receiver']['testReceiverPostLocation'] = { 'earl:outcome': 'earl:passed', 'earl:info': '<code>Location</code>: <a href="' + url + '">' + url + '</a> found and can be retrieved.' };
                  return Promise.resolve(testResults);
                },
                function(j){
// console.log(j);
                  testResults['receiver']['testReceiverPostLocation'] = { 'earl:outcome': 'earl:failed', 'earl:info': '<code>Location</code>: <a href="' + url + '">' + url + '</a> found but can not be retrieved: <code>HTTP ' + j.xhr.status + '</code> <q>' + j.xhr.responseText + '</q>' };
                  return Promise.resolve(testResults);
                });
            }
            else {
              testResults['receiver']['testReceiverPostLocation'] = { 'earl:outcome': 'earl:failed', 'earl:info': '<code>Location</code> header not found.' };
              return Promise.resolve(testResults);
            }
          }
          else {
            var url = '';
            if(location){
              url = '<code>Location</code>: <a href="' + url + '">' + url + '</a> found.';
            }
            testResults['receiver']['testReceiverPostLocation'] = { 'earl:outcome': 'earl:inapplicable', 'earl:info': url };
            return Promise.resolve(testResults);
          }
        }
      }
      else {
        testResults['receiver']['testReceiverPostResponse'] = { 'earl:outcome': 'earl:failed', 'earl:info': 'Response was <code>HTTP ' + response.xhr.status + '</code>. Should return <code>HTTP 201</code>.'};
        return Promise.resolve(testResults);
      }
    },
    function(reason){
// console.log(reason);
      var status = '<code>HTTP ' + reason.xhr.status + '</code>';
      var responseText = (reason.xhr.responseText.length > 0 ) ? ', <q>' + reason.xhr.responseText + '</q>' : '';

      testResults['receiver']['testReceiverPostResponse'] = { 'earl:outcome': 'earl:failed', 'earl:info': status + responseText };
      switch(reason.xhr.status){
        case 400:
          if('test-receiver-reject' in req.body) {
            testResults['receiver']['testReceiverPostResponse'] = { 'earl:outcome': 'earl:passed', 'earl:info': 'Deliberately rejected (' + status + ')' };
            testResults['receiver']['testReceiverPostResponseConstraintsUnmet'] = { 'earl:outcome': 'earl:passed', 'earl:info': 'Payload successfully filtered out (' + status + ')' };
          }
          //TODO: Maybe handle other formats here
          if(headers['Content-Type'] == 'application/ld+json'){ //TODO: && payload format is valid
            testResults['receiver']['testReceiverPostCreated'] = { 'earl:outcome': 'earl:failed', 'earl:info': '<em class="rfc2119">MUST</em> accept notifications where the request body is JSON-LD, with the <code>Content-Type: application/ld+json</code>' };
          }
          break;
        case 405:
          testResults['receiver']['testReceiverPostResponse'] = { 'earl:outcome': 'earl:failed', 'earl:info': '<em class="rfc2119">MUST</em> support <code>POST</code> request on the Inbox URL.' };
          break;
        case 415:
          if('test-receiver-reject' in req.body) {
            testResults['receiver']['testReceiverPostResponse'] = { 'earl:outcome': 'earl:passed', 'earl:info': status + '. Request with <code>Content-Type: ' + headers['Content-Type'] + '</code> has been rejected.' };
          }
          else {
            testResults['receiver']['testReceiverPostResponse'] = { 'earl:outcome': 'earl:failed', 'earl:info': status + '. Request with <code>Content-Type: ' + headers['Content-Type'] + '</code> is not allowed, or the payload does not correspond to this content-type. Check the payload syntax is valid, and make sure that the receiver is not having trouble with the <code>profile</code> or <code>charset</code> parameter.</code>.' };
          }
          testResults['receiver']['testReceiverPostLinkProfile'] = { 'earl:outcome': 'earl:inapplicable', 'earl:info': 'The request was possibly rejected due to the <q>profile</q> Link Relation. If the mediatype is recognised, it may be better to accept the request by ignoring the profile parameter.' };
          break;
        default:
          testResults['receiver']['testReceiverPostResponse'] = { 'earl:outcome': 'earl:failed', 'earl:info': status + responseText};
          break;
      }

      return Promise.resolve(testResults);
    });
}

function getRequirementLevelCode(level) {
  var s = level;
  switch(level) {
    default: s = outcome; break;
    case 'MUST': s = '!'; break;
    case 'SHOULD': s = '^'; break;
    case 'MAY': s = '~'; break;
  }
  return s;
}

function getRequirementLevelURL(level) {
  var s = level;
  switch(level) {
    default: s = outcome; break;
    case 'MUST': s = 'https://tools.ietf.org/html/rfc2119#section-1'; break;
    case 'SHOULD': s = 'https://tools.ietf.org/html/rfc2119#section-3'; break;
    case 'MAY': s = 'https://tools.ietf.org/html/rfc2119#section-5'; break;
  }
  return s;
}

function getEarlOutcomeCode(outcome){
  var s = outcome;
  switch(outcome) {
    default: s = outcome; break;
    case 'earl:passed': s = '✔'; break;
    case 'earl:failed': s = '✗'; break;
    case 'earl:cantTell': s = '?'; break;
    case 'earl:inapplicable': s = '⌙'; break;
    case 'earl:untested': s = '○'; break;
  }
  return s;
}

function getEarlOutcomeHTML(){
return `
<dl>
  <dt class="earl:passed"><abbr title="Passed">${getEarlOutcomeCode('earl:passed')}</abbr></dt><dd><a href="https://www.w3.org/TR/EARL10-Schema/#passed">Passed</a></dd>
  <dt class="earl:failed"><abbr title="Failed">${getEarlOutcomeCode('earl:failed')}</abbr></dt><dd><a href="https://www.w3.org/TR/EARL10-Schema/#failed">Failed</a></dd>
  <dt class="earl:cantTell"><abbr title="Cannot tell">${getEarlOutcomeCode('earl:cantTell')}</abbr></dt><dd><a href="https://www.w3.org/TR/EARL10-Schema/#cantTell">Cannot tell</a></dd>
  <dt class="earl:inapplicable"><abbr title="Inapplicable">${getEarlOutcomeCode('earl:inapplicable')}</abbr></dt><dd><a href="https://www.w3.org/TR/EARL10-Schema/#inapplicable">Inapplicable</a></dd>
  <dt class="earl:untested"><abbr title="Untested">${getEarlOutcomeCode('earl:untested')}</abbr></dt><dd><a href="https://www.w3.org/TR/EARL10-Schema/#untested">Untested</a></dd>
</dl>`;
}

function getTestReportHTML(test, implementation){
  var s = [];
  implementation = implementation || 'receiver';

  Object.keys(ldnTests[implementation]).forEach(function(id){
    var testResult = '';

    if(typeof test[id] == 'undefined'){
      test[id] = { 'earl:outcome': 'earl:untested', 'earl:info': '' };
    }

    testResult = getEarlOutcomeCode(test[id]['earl:outcome']);

    s.push('<tr><td class="' + test[id]['earl:outcome'] + '">' + testResult + '</td><td class="test-description">' + ldnTests[implementation][id]['description'] + '</td><td class="test-message">' + test[id]['earl:info'] + '</td></tr>');
  });

  return s.join("\n");
}

function testResponse(req, test, reportHTML){
  var sendReportURL = req.getRootUrl() + '/send-report';
  return `
    <div id="test-response">
      <table id="test-report">
        <caption>Test report</caption>
        <thead><tr><th>Result</th><th>Test</th><th>Info</th></tr></thead>
        <tfoot><tr><td colspan="4">
${getEarlOutcomeHTML()}
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
              <p>This form is to test implementations of LDN receivers. Input the URL of an Inbox, and when you submit, it fires off several HTTP requests with the various combinations of parameters and headers that you are required to support in order for senders to create new notifications and consumers to retreive them.</p>

              <p>We provide a default notification payload, but if you have a specilised implementation you may want to modify this to your needs.</p>

              <p>If your receiver is setup to reject certain payloads (LDN suggests you implement some kinds of constraints or filtering), you can input one such payload and check the <q>Receiver should reject this notification</q> box. If your receiver rejects the POST requests, you will <em>pass</em> the relevant tests.</p>

              <p>Reports will be submitted to an <a about="" rel="ldp:inbox" href="reports/">inbox</a>.</p>

              <form action="#test-response" class="form-tests" id="test-receiver" method="post">
                <fieldset>
                  <legend>Test Receiver</legend>

                  <ul>
                     <li>
                      <label for="test-receiver-url">URL</label>
                      <input type="text" name="test-receiver-url" placeholder="http://example.org/inbox/" value="" />
                    </li>

                    <li>
                      <label for="test-receiver-data">Data</label>
                      <textarea name="test-receiver-data" cols="80" rows="3" placeholder="Enter data">{ "@id": "http://example.net/note#foo", "http://schema.org/citation": { "@id": "http://example.org/article#results" } }</textarea>
                    </li>
                    <li>
                      <input type="checkbox" name="test-receiver-reject" checkbox="checkbox" />
                      <label for="test-receiver-reject">Receiver should reject this notification</label>
                      <input type="checkbox" name="test-receiver-get-notifications-limited" checkbox="checkbox" />
                      <label for="test-receiver-get-notifications-limited">Receiver may restrict list of notifications</label>
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


function createTestReport(req, res, next){
  var test = JSON.parse(atob(req.body['test-report-value']));
  var observations = [];
  var date = new Date();
  var dateTime = date.toISOString();

  var implementation = '';
  var maintainer = '';
  if(req.body['implementation'] && req.body['implementation'].length > 0 && req.body['maintainer'] && req.body['maintainer'].length > 0) {
    if (req.body['implementation'].startsWith('http') && req.body['maintainer'].startsWith('http')) {
      implementation = req.body['implementation'].trim();
      maintainer = req.body['maintainer'].trim();
      name = req.body['name'].trim();
    }
    else {
      res.status(400);
      res.send('Please submit the implementation report with URIs of the implementation and maintainer.');
      res.end();
      return;
    }
  }
  else {
    res.status(400);
    res.send('Please submit the implementation report with URIs of the implementation and maintainer.');
    res.end();
    return;
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


  var dataset = `<dl>
  <dt>Identifier</dt>
  <dd property="dcterms:identifier" xml:lang="" lang="">${test['id']}</dd>
  <dt>Published</dt>
  <dd><time content="${dateTime}" datatype="xsd:dateTime" datetime="${dateTime}" property="as:published">${dateTime.slice(0, dateTime.indexOf("T"))}</time></dd>
  <dt>Creator</dt>
  <dd><a href="${maintainer}" property="as:creator">${maintainer}</a></dd>${datasetNote}
</dl>`;

  var datasetSeeAlso = [];
  Object.keys(test['results']).forEach(function(i){
    var testId = ldnTests[test['implementationType']][i]['uri'].split('#')[1];
    datasetSeeAlso.push('<meta resource="#' + testId + '" />');

    var earlInfo = '';
    if(test['results'][i]['earl:info'] != '') {
      earlInfo = `<td property="earl:result" resource="#result-${testId}" typeof="earl:TestResult"><span datatype="rdf:HTML" property="earl:info">${test['results'][i]['earl:info']}</span></td>`;
    }
    else {
      earlInfo = `<td property="earl:result" resource="#result-${testId}" typeof="earl:TestResult"><span datatype="rdf:HTML" property="earl:info"></span></td>`;
    }

    var earlMode = ldnTests[test['implementationType']][i]['earl:mode'];
    var earlModeText = earlMode.substr(earlMode.indexOf(':') + 1);

    observations.push(`
<tr id="${testId}" about="#${testId}" typeof="qb:Observation earl:Assertion">
  <td property="earl:result" resource="#result-${testId}" typeof="earl:TestResult"><span property="earl:outcome" resource="${test['results'][i]['earl:outcome']}">${getEarlOutcomeCode(test['results'][i]['earl:outcome'])}</span></td>
  <td><meta property="qb:dataSet" resource="" /><meta property="earl:subject" resource="${implementation}" />${ldnTests[test['implementationType']][i]['description']} [<a property="earl:test" href="${ldnTests[test['implementationType']][i]['uri']}">source</a>]</td>
  <td property="earl:mode" resource="${earlMode}"><a href="https://www.w3.org/TR/EARL10-Schema/#${earlModeText}">${earlModeText}</a></td>
  ${earlInfo}
</tr>`);
  });
  observations = observations.join('');

  datasetSeeAlso = datasetSeeAlso.join('');

  return `<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <title>${name} LDN implementation report and test results</title>
    <meta content="width=device-width, initial-scale=1" name="viewport" />
    <link href="${req.getRootUrl()}/media/css/ldntests.css" media="all" rel="stylesheet" />
  </head>

  <body about="" prefix="${prefixesRDFa}" typeof="schema:CreativeWork sioc:Post prov:Entity">
    <main>
      <article about="" typeof="schema:Article qb:DataSet as:Object">
        <h1 property="schema:name">${name} LDN implementation report and test results</h1>
          <div id="content">
            <section>
              <h2>Description of a project</h2>
              <div>
${doap}
              </div>
            </section>

            <section>
              <h2 rel="qb:structure" resource="https://www.w3.org/TR/ldn/#data-structure-definition">Dataset</h2>
              <div>
${dataset}
              </div>
            </section>

            <section>
              <h2>Test results</h2>
              <div>
                <table>
                  <caption>Report</caption>
                  <thead>
                    <tr>
                      <th title="Outcome of performing the test"><a href="https://www.w3.org/TR/EARL10-Schema/#outcome">Outcome</a></th>
                      <th title="Test criterion"><a href="https://www.w3.org/TR/EARL10-Schema/#test">Test</a></th>
                      <th title="Describes how a test was carried out"><a href="https://www.w3.org/TR/EARL10-Schema/#mode">Mode</a></th>
                      <th title="Additional warnings or error messages in a human-readable form"><a href="https://www.w3.org/TR/EARL10-Schema/#info">Info</a></th>
                    </tr>
                  </thead>
                  <tfoot>
                    <tr><td colspan="4">${getEarlOutcomeHTML()}</td></tr>
                    <tr><td about="" colspan="4" rel="rdfs:seeAlso">${datasetSeeAlso}</td></tr>
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
    var test;
    var data;
    if(req.body['test-report-value'] && req.body['test-report-value'].length > 0) {
      test = JSON.parse(atob(req.body['test-report-value']));
      data = createTestReport(req, res, next);
      if (!data) {
        return;
      }
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
    postResource(reportsInbox, test['id'], data, headers['Content-Type']).then(
      function(response){
        var location = response.xhr.getResponseHeader('Location');
        res.set('Content-Type', 'text/html;charset=utf-8');
        var responseBody = '';
        switch(response.xhr.status){
          case 201:
            responseBody = '<p>Okieli dokieli, report submitted: <a href="' + location + '">' + location + '</a>. Thank you for your contribution. See also the <a href="summary">summary</a> for all implementation reports.</p>';
            break;
          case 202:
            responseBody = '<p>' + response.xhr.responseText + '</p><p><code>HTTP 202</code>: This is probably because the request content length was greater than <code>maxPayloadSize</code> in <a href="https://github.com/csarven/mayktso">mayktso</a>.</p>';
            break;
          default:
            break;
        }
        res.status(200);
        res.send(responseBody);
        res.end();
        return;
      },
      function(reason){
        res.set('Content-Type', 'text/html;charset=utf-8');
        res.status(reason.xhr.status);
        res.send('Well, something went wrong: ' + reason.xhr.responseText);
        res.end();
        return;
      }
    );
  }
  else {
    res.status(405);
    res.end();
    return;
  }
}


function showSummary(req, res, next){
  switch(req.method){
    //TODO: This only responds to text/html. Maybe include RDFa? Anything new/interesting for the report?
    case 'GET':
      if(!req.accepts(['text/html', '*/*'])) {
        resStatus(res, 406);
        return;
      }

      //XXX: Currently unused.
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

      //TODO: Ideally this would loop through each target (sender, receiver, consumer), find their inboxes and their notifications. Since they use the same inbox, this is only looking up one of them. A nicer/proper/strict way of doing it would be to go through each target, have a unique list of notifications (since in our case each notification URI will be listed 3 times).
      //Discover Inbox
      var baseURL = getBaseURL(req.getUrl());
      var base = baseURL.endsWith('/') ? baseURL : baseURL + '/';
      var basePath = config.basePath.endsWith('/') ? config.basePath : '';
      var url = base + basePath + 'receiver';

      discoverInbox(url).then(
        function(inboxes){
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
                    nData.push(SimpleRDF(vocab, nURL, null, RDFstore).get());
                  })
                  return Promise.all(nData)
                });
            });
        })
        .then(
        function(s){//s is an array of SimpleRDF promises
// console.log(s);
          var report = {};
          var reports = {};

          s.forEach(function(g){
            var implementationURI = '';
            g.graph().forEach(function(t){
              if(t.object.nominalValue == vocab['doapProject']['@id']){
                implementationURI = t.subject.nominalValue;
              }
            });

            var report = {};
            var implementation = g.child(implementationURI);
            report['implementation'] = implementationURI;
            report['name'] = (implementation.doapname && implementation.doapname.length > 0) ? implementation.doapname : implementationURI;

            var implementationType = '';
            implementation.rdftype.forEach(function(i){
              if(i.startsWith('https://www.w3.org/TR/ldn/#')){
                implementationType = i;
              }
            });

            report['tests'] = [];
            g.rdfsseeAlso.forEach(function(observationURI){
              var observation = g.child(observationURI);
              var earlresult = observation.earlresult;
              var outcome = g.child(earlresult).earloutcome.split('#')[1];

              report['tests'][observation.earltest] = 'earl:'+outcome;
            });

            report['report'] = g.iri().toString();
            reports[implementationType] = reports[implementationType] || [];
            reports[implementationType].push(report);
          });

// console.log(reports);
          var data = getReportsHTML(req, res, next, reports);

          if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
            res.status(304);
            res.end();
            return;
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
          return;
        },
        function(reason){
          res.status(500);
          res.end();
          return;
        }
      );
      break;

    default:
      res.status(405);
      res.set('Allow', 'GET');
      res.end();
      return;
      break;
  }
}

function getReportsHTML(req, res, next, reports){
    var testsSummary = '';
    Object.keys(reports).forEach(function(testType){
      var testTypeCode = testType.split('#')[1];
      var tests = Object.keys(ldnTests[testTypeCode]);
      var testsCount = tests.length;
      var testTypeCapitalised = testTypeCode[0].toUpperCase() + testTypeCode.slice(1);
      var testDefinitions = [];
      var testRequirementLevels = ['MUST', 'SHOULD', 'MAY'];
      var testRequirementLevelsHTML = '';
      var testRequirementLevelsCount = {};
      testRequirementLevels.forEach(function(level){
        // testRequirementLevelsHTML += '<dt id="' + testTypeCode + '-' + level + '">' + getRequirementLevelCode(level) + '</dt><dd><a class="rfc2119" href="' + getRequirementLevelURL(level) + '">' + level + '</a></dd>';
        // testRequirementLevelsHTML += '<dt id="' + testTypeCode + '-' + level + '"></dt><dd><a class="rfc2119" href="' + getRequirementLevelURL(level) + '">' + level + '</a></dd>';
        testRequirementLevelsCount[level] = 0;
      });
      // var testRequirementDefinitions = '<dl>' + testRequirementLevelsHTML + '</dl>';

      var theadTRs = '<tr><th rowspan="3">Implementations</th><th colspan="' + testsCount + '">' + testTypeCapitalised + ' tests</th></tr>';
      var testsTR = '<tr>';
      var testMapNotation = {
        'testReceiverGetLDPContainer': 'GLCR',
        'testConsumerHeaderDiscovery': 'HDC',
        'testConsumerBodyDiscovery': 'BDC',
        'testConsumerNotificationChangelog': 'NCG',
        'testConsumerNotificationCitation': 'NCN',
        'testConsumerNotificationAssessing': 'NAG',
        'testConsumerNotificationComment': 'NCT',
        'testConsumerNotificationAnnounce': 'NAE',
        'testSenderHeaderDiscovery': 'HDS',
        'testSenderBodyDiscovery': 'BDS'
      };
      tests.forEach(function(test){
        var notation = ldnTests[testTypeCode][test]['uri'].split('#test-' + testTypeCode + '-')[1].split('-').map(function(i){ return i[0]; }).join('').toUpperCase();
        notation = testMapNotation[test] || notation;
        // notation = testTypeCode[0].toUpperCase() + notation;
        // notation = test;
        var requirementLevel = ldnTests[testTypeCode][test]['requirement'];
        testRequirementLevelsCount[requirementLevel] = testRequirementLevelsCount[requirementLevel] + 1;
        // testsTR += '<th><a href="#' + notation + '">' + notation + '</a><sup class="rfc2119"><a href="#' + testTypeCode + '-' + requirementLevel + '">' + getRequirementLevelCode(requirementLevel) + '</a></sup></th>';
        testsTR += '<th><a href="#' + notation + '">' + notation + '</a></th>';

        testDefinitions.push('<dt id="' + notation + '">' + notation + '</dt><dd>' + ldnTests[testTypeCode][test]['description'] + ' [<a href="' + ldnTests[testTypeCode][test]['uri'] + '">source</a>]</dd>');
      });
      testsTR += '</tr>';

      var requiredTestsCount = testRequirementLevelsCount['MUST'];
      var optionalTestsCount = testRequirementLevelsCount['SHOULD'] + testRequirementLevelsCount['MAY'];
      var testColsTR = '<tr colspan="15">';
      if(requiredTestsCount > 0){
       testColsTR += '<th colspan="' + requiredTestsCount + '">Required for interop</th>';
      }
      if(optionalTestsCount > 0){
        testColsTR += '<th colspan="' + optionalTestsCount + '">Optional</th>';
      }
      testColsTR += '</tr>';
      theadTRs += testColsTR + testsTR;

      testDefinitions = '<dl class="abbr">' + testDefinitions.join('') + '</dl>';

      var tbodyTRs = '';
      var reportCount = reports[testType].length;
      reports[testType].forEach(function(report){
        tbodyTRs += '<tr>';
        tbodyTRs += '<td><a href="' + report['implementation'] + '">' + report['name'] + '</a> (<a about="" rel="void:subset" href="' + report['report'] + '">report</a>)</td>';
        tests.forEach(function(test){
          var outcomeCode = report['tests'][ldnTests[testTypeCode][test]['uri']];
          tbodyTRs += '<td class="'+ outcomeCode +'">'+getEarlOutcomeCode(outcomeCode)+'</td>';
        });
        tbodyTRs += '</tr>';
      });

      testsSummary += `
          <section id="ldn-report-${testTypeCode}" rel="schema:hasPart" resource="#ldn-report-${testTypeCode}">
            <h2 property="schema:name">${testTypeCapitalised} reports</h2>
            <div datatype="rdf:HTML" property="schema:description">
              <table id="ldn-test-${testTypeCode}-summary">
                <caption>${testTypeCapitalised} tests summary</caption>
                <thead>
${theadTRs}
                </thead>
                <tbody>
${tbodyTRs}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="${testsCount + 1}">
                      <dl>
                        <dt>Number of implementation reports</dt>
                        <dd>${reportCount}</dd>
                      </dl>
${getEarlOutcomeHTML()}
${testDefinitions}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>`;
    });

    return `<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <title>LDN Test Reports and Summary</title>
    <meta content="width=device-width, initial-scale=1" name="viewport" />
    <link href="${req.getRootUrl()}/media/css/ldntests.css" media="all" rel="stylesheet" />
  </head>

  <body about="" prefix="${prefixesRDFa}" typeof="schema:CreativeWork sioc:Post prov:Entity">
    <main>
      <article about="" typeof="schema:Article void:Dataset">
        <h1 property="schema:name">LDN Test Reports and Summary</h1>

        <dl id="document-test-suite">
          <dt>Test suite</dt>
          <dd><a href="https://linkedresearch.org/ldn/tests/">https://linkedresearch.org/ldn/tests/</a></dd>
        </dl>

        <dl id="document-license">
          <dt>License</dt>
          <dd><a href="https://creativecommons.org/licenses/by/4.0/" rel="schema:license" title="Creative Commons Attribution 4.0 Unported">CC BY 4.0</a></dd>
        </dl>

        <dl id="document-published">
          <dt>Published</dt>
          <dd><time datatype="xsd:dateTime" datetime="2016-09-18T00:00:00Z" property="schema:datePublished">2016-09-18</time></dd>
        </dl>

        <dl id="document-modified">
          <dt>Modified</dt>
          <dd><time datatype="xsd:dateTime" datetime="2018-01-05T00:00:00Z" property="schema:dateModified">2018-01-05</time></dd>
        </dl>

        <dl id="document-repository">
          <dt>Repository</dt>
          <dd><a href="https://github.com/w3c/ldn">GitHub</a></dd>
          <dd><a href="https://github.com/w3c/ldn/issues">Issues</a></dd>
        </dl>

        <dl id="document-status">
          <dt>Status</dt>
          <dd><a href="https://www.w3.org/TR/ldn/">Linked Data Notifications</a> is a W3C Recommendation</dd>
        </dl>

        <div id="content">
          <section id="keywords">
            <h2>Keywords</h2>
            <div>
              <ul rel="schema:about">
                <li><a href="https://en.wikipedia.org/wiki/Communications_protocol" resource="http://dbpedia.org/resource/Communications_protocol">Communications protocol</a></li>
                <li><a href="https://en.wikipedia.org/wiki/Decentralization" resource="http://dbpedia.org/resource/Decentralization">Decentralisation</a></li>
                <li><a href="https://en.wikipedia.org/wiki/Linked_data" resource="http://dbpedia.org/resource/Linked_data">Linked Data</a></li>
                <li><a href="https://en.wikipedia.org/wiki/Social_web" resource="http://dbpedia.org/resource/Social_web">Social web</a></li>
              </ul>
            </div>
          </section>

${testsSummary}
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
      return;
      break;
  }
  if(!req.requestedType){
    resStatus(res, 406);
    return;
  }

  //XXX: We don't care about the error
  // if(error) {}
  var discoverInboxHTML = '';

  switch(req.originalUrl) {
    case '/discover-inbox-link-header':
      discoverInboxHTML = `<p>This target resource announces its Inbox in the HTTP headers.</p>`;
      break;
    case '/discover-inbox-rdf-body':
      discoverInboxHTML = `<p>This target resource announces its <a href="inbox-expanded/" rel="ldp:inbox">Inbox</a> right here.</p>`;
      break;
    default:
      if(req.originalUrl.startsWith('/target/')){
        var reqresData = '';
        var requestedTarget = req.requestedPath;
        if(req.params.id && req.params.id.length > 0 && !req.params.id.match(/\/?\.\.+\/?/g)){
          requestedTarget = config.rootPath + '/inbox-sender/' + req.params.id;
        }

        var files = [requestedTarget+'.link-header', requestedTarget+'.link-header.json', requestedTarget+'.rdf-body', requestedTarget+'.rdf-body.json'];
        // console.log(files);

        //XXX: This also works.
        // var readFileContents = files.map((file) => {
        //   return require('fs-promise').readFile(file, 'utf8')
        //     .catch(err => {
        //       return null
        //     })
        // })
        var fileContents = files.map((file) => {
          try {
            return fs.readFileSync(file, 'utf8')
          } catch (error) {
            return null
          }
        });
      // console.log(fileContents);
        var dataLinkHeader = (fileContents[0]) ? fileContents[0] : undefined;
        var metaDataLinkHeader = (fileContents[1]) ? JSON.parse(fileContents[1]) : undefined;
        var dataRDFBody = (fileContents[2]) ? fileContents[2] : undefined;
        var metaDataRDFBody = (fileContents[3]) ? JSON.parse(fileContents[3]) : undefined;
// console.log(dataLinkHeader);
// console.log(metaDataLinkHeader);
// console.log(dataRDFBody);
// console.log(metaDataRDFBody);

        var inboxBaseIRI = req.getRootUrl() + '/inbox-sender/';
        var inboxIRI = inboxBaseIRI + '?id=' + req.params.id;

        discoverInboxHTML += `<p>When you <em>send</em> a notification with this page as the target, the results will show up here. New notifications sent to here will overwrite previous notifications. Jump to <a href="#test-sender">view and send report</a>.</p>`;
        if(req.query && 'discovery' in req.query && req.query['discovery'] == 'rdf-body') {
          discoverInboxHTML += `
                          <p>This target resource announces its <a href="${inboxIRI}&amp;discovery=rdf-body" rel="ldp:inbox">inbox through RDFa in its body</a>.</p>`;
        }else if(req.query && 'discovery' in req.query && req.query['discovery'] == 'link-header'){
          discoverInboxHTML += `
                          <p>This target resource announces its inbox in a <code>Link</code> header.</p>`;
        }
        if(typeof dataLinkHeader !== 'undefined' || typeof metaDataLinkHeader !== 'undefined' || typeof dataRDFBody !== 'undefined' || typeof metaDataRDFBody !== 'undefined') {
          if (typeof metaDataLinkHeader !== 'undefined' || typeof metaDataRDFBody !== 'undefined'){
            var results= {};
            if (typeof metaDataLinkHeader !== 'undefined'){
              results['testSenderHeaderDiscovery'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' }
              results['testSenderHeaderPostRequest'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' }
              results['testSenderHeaderPostContentTypeJSONLD'] = { 'earl:outcome': 'earl:inapplicable', 'earl:info': '' }
              results['testSenderHeaderPostValidJSONLD'] = { 'earl:outcome': 'earl:untested', 'earl:info': '' }

              var cT = metaDataLinkHeader.req.headers["content-type"];
              if(cT.split(';')[0].trim() == 'application/ld+json') {
                results['testSenderHeaderPostContentTypeJSONLD'] = { 'earl:outcome': 'earl:passed', 'earl:info': '<code>Content-Type: ' + cT + '</code> received.' }
              }
              else {
                results['testSenderHeaderPostContentTypeJSONLD'] = { 'earl:outcome': 'earl:failed', 'earl:info': '<code>Content-Type: ' + cT + '</code> received. Use <code>application/ld+json</code>.' }
              }

              switch(parseInt(metaDataLinkHeader.res.statusCode)){
                case 201: case 202:
                  results['testSenderHeaderPostValidJSONLD'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' }
                  break;
                case 400:
                  results['testSenderHeaderPostValidJSONLD'] = { 'earl:outcome': 'earl:failed', 'earl:info': 'Send valid JSON-LD payload.' }
                  break;
              }
            }
            if (typeof metaDataRDFBody !== 'undefined'){
              results['testSenderBodyDiscovery'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' }
              results['testSenderBodyPostRequest'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' }
              results['testSenderBodyPostContentTypeJSONLD'] = { 'earl:outcome': 'earl:inapplicable', 'earl:info': '' }
              results['testSenderBodyPostBodyJSONLD'] = { 'earl:outcome': 'earl:untested', 'earl:info': '' }

              var cT = metaDataRDFBody.req.headers["content-type"];
              if(cT.split(';')[0].trim() == 'application/ld+json') {
                results['testSenderBodyPostContentTypeJSONLD'] = { 'earl:outcome': 'earl:passed', 'earl:info': '<code>Content-Type: ' + cT + '</code> received.' }
              }
              else {
                results['testSenderBodyPostContentTypeJSONLD'] = { 'earl:outcome': 'earl:failed', 'earl:info': '<code>Content-Type: ' + cT + '</code> received. Use <code>application/ld+json</code>.' }
              }

              switch(parseInt(metaDataRDFBody.res.statusCode)){
                case 201: case 202:
                  results['testSenderBodyPostBodyJSONLD'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' }
                  break;
                case 400:
                  results['testSenderBodyPostBodyJSONLD'] = { 'earl:outcome': 'earl:failed', 'earl:info': 'Send valid JSON-LD payload.' }
                  break;
              }
            }

            var reportHTML = getTestReportHTML(results, 'sender');
            var test = {'url': 'TODO: ' };
            test['implementationType'] = 'sender';
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
                    <h2>Requests Received</h2>
                    <div>`;
          var requestHeaders = [];
          if (typeof metaDataLinkHeader !== 'undefined'){
            requestHeaders.push(metaDataLinkHeader.req.method + ' ' + metaDataLinkHeader.req.url + ' HTTP/' + metaDataLinkHeader.req.httpVersion);
            Object.keys(metaDataLinkHeader.req.headers).forEach(function(i){
              requestHeaders.push(i.replace(/\b\w/g, l => l.toUpperCase()) + ': ' + metaDataLinkHeader.req.headers[i]);
            });

            reqresData += `
                      <dl>
                        <dt>Request</dt>
                        <dd><pre>${preSafe(requestHeaders.join("\n"))}</pre></dd>

                        <dt>Response</dt>
                        <dd><pre>${preSafe(JSON.stringify(metaDataLinkHeader.res.rawHeaders)).slice(1, -1)}</pre></dd>
                      </dl>`;
          }
          if (typeof dataLinkHeader !== 'undefined'){
            reqresData += `
                      <p>Created <code><a href="${metaDataLinkHeader.res.headers.location}">${metaDataLinkHeader.res.headers.location}</a></code>:</p>
                      <pre>${dataLinkHeader}</pre>`;
          }

          if (typeof metaDataRDFBody !== 'undefined'){
            requestHeaders = [];
            requestHeaders.push(metaDataRDFBody.req.method + ' ' + metaDataRDFBody.req.url + ' HTTP/' + metaDataRDFBody.req.httpVersion);
            Object.keys(metaDataRDFBody.req.headers).forEach(function(i){
              requestHeaders.push(i.replace(/\b\w/g, l => l.toUpperCase()) + ': ' + metaDataRDFBody.req.headers[i]);
            });

            reqresData += `
                    <dl>
                      <dt>Request</dt>
                      <dd><pre>${preSafe(requestHeaders.join("\n"))}</pre></dd>

                      <dt>Response</dt>
                      <dd><pre>${preSafe(JSON.stringify(metaDataRDFBody.res.rawHeaders)).slice(1, -1)}</pre></dd>
                    </dl>`;
          }
          if (typeof dataRDFBody !== 'undefined'){
            reqresData += `
                    <p>Created <code><a href="${metaDataRDFBody.res.headers.location}">${metaDataRDFBody.res.headers.location}</a></code>:</p>
                    <pre>${dataRDFBody}</pre>`;
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
    <title>Sender Test Results</title>
    <meta content="width=device-width, initial-scale=1" name="viewport" />
    <link href="${req.getRootUrl()}/media/css/ldntests.css" media="all" rel="stylesheet" />
  </head>

  <body about="" prefix="${prefixesRDFa}" typeof="schema:CreativeWork sioc:Post prov:Entity">
    <main>
      <article about="" typeof="schema:Article">
        <h1 property="schema:name">Sender Test Results</h1>

        <div id="content">
          <section>
            <h2>Discovery and Sending</h2>
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
    if(req.originalUrl.startsWith('/target/') && req.query && 'discovery' in req.query && req.query['discovery'] == 'link-header'){
      linkRelations.push('<' + inboxIRI + '&discovery=link-header>; rel="http://www.w3.org/ns/ldp#inbox"');
    }
    res.set('Link', linkRelations);
    res.set('Content-Type', contentType +';charset=utf-8');
    res.set('Content-Length', Buffer.byteLength(outputData, 'utf-8'));
    res.set('ETag', etag(outputData));
    // res.set('Last-Modified', stats.mtime);
    res.set('Vary', 'Origin');
    res.set('Allow', 'GET, HEAD, OPTIONS');
  }

  if(req.accepts(['text/html', 'application/xhtml+xml', '*/*'])){
    sendHeaders(outputData, 'text/html');
    res.status(200);
    res.send(outputData);
    return next();
  }
  else {
    var options = { 'subjectURI': req.getUrl() };
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
        return;
      },
      function(reason){
        res.status(500);
        res.end();
        return;
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
        resStatus(res, 406);
        return;
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
         '1': testConsumerHeaderDiscovery
        ,'2': testConsumerBodyDiscovery
        ,'3': testConsumerListingJSONLDCompacted
        ,'4': testConsumerListingJSONLDExpanded
        ,'5': testConsumerNotificationAnnounce
        ,'6': testConsumerNotificationChangelog
        ,'7': testConsumerNotificationCitation
        ,'8': testConsumerNotificationAssessing
        ,'9': testConsumerNotificationComment
        ,'10': testConsumerNotificationRSVP
      };

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
          test['implementationType'] = 'consumer';
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
          return;
        })
        .catch((e) => {
          console.log('--- catch ---');
          console.log(e);
          res.end();
          return;
        });
      break;

    default:
      res.status(405);
      res.set('Allow', 'GET, POST');
      res.end();
      return;
      break;
  }
}


function testConsumerHeaderDiscovery(req){
  var testResults = { 'consumer': {} };
  testResults['consumer']['testConsumerHeaderDiscovery'] = { 'earl:outcome': 'earl:untested', 'earl:info': 'No input was provided.' };
  var value = req.body['test-consumer-discover-inbox-link-header'];
  if(typeof value === 'undefined' || value.trim().length == 0){ return Promise.resolve(testResults); }
  value = value.trim();
  var inbox = getExternalBaseURL(req.getUrl()) + 'inbox-compacted/';

  if(value == inbox){
    testResults['consumer']['testConsumerHeaderDiscovery'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' };
  }
  else {
    testResults['consumer']['testConsumerHeaderDiscovery'] = { 'earl:outcome': 'earl:failed', 'earl:info': 'test the Inbox URL again. Make sure to only include the URL.' };
  }
  return Promise.resolve(testResults);
}

function testConsumerBodyDiscovery(req){
  var testResults = { 'consumer': {} };
  testResults['consumer']['testConsumerBodyDiscovery'] = { 'earl:outcome': 'earl:untested', 'earl:info': 'No input was provided.' };
  var value = req.body['test-consumer-discover-inbox-rdf-body'];
  if(typeof value === 'undefined' || value.trim().length == 0){ return Promise.resolve(testResults); }
  value = value.trim();
  var inbox = getExternalBaseURL(req.getUrl()) + 'inbox-expanded/';

  if(value.length > 0 && value == inbox){
    testResults['consumer']['testConsumerBodyDiscovery'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' };
  }
  else {
    testResults['consumer']['testConsumerBodyDiscovery'] = { 'earl:outcome': 'earl:failed', 'earl:info': 'test the Inbox URL again. Make sure to only include the URL.' };
  }
  return Promise.resolve(testResults);
}

function testConsumerListingJSONLDCompacted(req){
  var testResults = { 'consumer': {} };
  testResults['consumer']['testConsumerListingJSONLDCompacted'] = { 'earl:outcome': 'earl:untested', 'earl:info': 'No input was provided.' };
  var value = req.body['test-consumer-inbox-compacted'];
  if(typeof value === 'undefined' || value.trim().length == 0){ return Promise.resolve(testResults); }
  value = value.trim().split(' ');
  var inbox = getExternalBaseURL(req.getUrl()) + 'inbox-compacted/';
  var notifications = [inbox+'announce', inbox+'changelog', inbox+'citation'];

  testResults['consumer']['testConsumerListingJSONLDCompacted'] = { 'earl:outcome': 'earl:failed', 'earl:info': 'Expecting ' + notifications.length + ' notifications. Make sure to separate by a space.' };

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
      testResults['consumer']['testConsumerListingJSONLDCompacted'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' };
    }
    else {
      testResults['consumer']['testConsumerListingJSONLDCompacted'] = { 'earl:outcome': 'earl:failed', 'earl:info': 'Notifications found:' + found + '/' + notifications.length + '. Make sure to separate by a space.' };
    }
  }
  return Promise.resolve(testResults);
}


function testConsumerListingJSONLDExpanded(req){
  var testResults = { 'consumer': {} };
  testResults['consumer']['testConsumerListingJSONLDExpanded'] = { 'earl:outcome': 'earl:untested', 'earl:info': 'No input was provided.' };
  var value = req.body['test-consumer-inbox-expanded'];
  if(typeof value === 'undefined' || value.trim().length == 0){ return Promise.resolve(testResults); }
  value = value.trim().split(' ');
  var inbox = getExternalBaseURL(req.getUrl()) + 'inbox-expanded/';
  var notifications = [inbox+'assessing', inbox+'comment', inbox+'rsvp'];

  testResults['consumer']['testConsumerListingJSONLDExpanded'] = { 'earl:outcome': 'earl:failed', 'earl:info': 'Expecting ' + notifications.length + ' notifications. Make sure to separate by a space.' };

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
      testResults['consumer']['testConsumerListingJSONLDExpanded'] = { 'earl:outcome': 'earl:passed', 'earl:info': '' };
    }
    else {
      testResults['consumer']['testConsumerListingJSONLDExpanded'] = { 'earl:outcome': 'earl:failed', 'earl:info': 'Notifications found:' + found + '/' + notifications.length + '. Make sure to separate by a space.' };
    }
  }
  return Promise.resolve(testResults);
}

function testConsumerNotificationAnnounce(req){
  var options = {
    'test': 'testConsumerNotificationAnnounce',
    'data': req.body['test-inbox-compacted-announce'],
    'subject': getExternalBaseURL(req.getUrl()) + 'inbox-compacted/announce',
    'property': vocab['rdftype']['@id'],
    'object': 'https://www.w3.org/ns/activitystreams#Announce'
  };
  return testNotification(req, options);
}

function testConsumerNotificationChangelog(req){
  var options = {
    'test': 'testConsumerNotificationChangelog',
    'data': req.body['test-inbox-compacted-changelog'],
    'subject': 'http://example.org/activity/804c4e7efaa828e146b4ada1c805617ffbc79dc7',
    'property': vocab['rdftype']['@id'],
    'object': 'http://www.w3.org/ns/prov#Activity'
  };
  return testNotification(req, options);
}

function testConsumerNotificationCitation(req){
  var options = {
    'test': 'testConsumerNotificationCitation',
    'data': req.body['test-inbox-compacted-citation'],
    'subject': 'http://example.net/note#foo',
    'property': 'http://schema.org/citation',
    'object': 'http://example.org/article#results'
  };
  return testNotification(req, options);
}

function testConsumerNotificationAssessing(req){
  var options = {
    'test': 'testConsumerNotificationAssessing',
    'data': req.body['test-inbox-expanded-assessing'],
    'subject': 'http://example.net/note',
    'property': 'http://www.w3.org/ns/oa#motivatedBy',
    'object': 'http://www.w3.org/ns/oa#assessing'
  };
  return testNotification(req, options);
}

function testConsumerNotificationComment(req){
  var options = {
    'test': 'testConsumerNotificationComment',
    'data': req.body['test-inbox-expanded-comment'],
    'subject': getExternalBaseURL(req.getUrl()) + 'inbox-expanded/comment',
    'property': 'http://rdfs.org/sioc/ns#reply_of',
    'object': 'http://example.org/article'
  };
  return testNotification(req, options);
}

function testConsumerNotificationRSVP(req){
  var options = {
    'test': 'testConsumerNotificationRSVP',
    'data': req.body['test-inbox-expanded-rsvp'],
    'subject': getExternalBaseURL(req.getUrl()) + 'inbox-expanded/rsvp',
    'property': 'http://schema.org/event',
    'object': 'http://example.org/event'
  };
  return testNotification(req, options);
}

function testNotification(req, options){
  var testResults = { 'consumer': {} };
  testResults['consumer'][options.test] = { 'earl:outcome': 'earl:untested', 'earl:info': 'No input was provided.' };
  if(options.data.length == 0){ return Promise.resolve(testResults); }
  options.data = options.data.trim();

  var o = {
    'contentType': 'application/ld+json',
    'subjectURI': options.subject
  }

  try { JSON.parse(options.data) }
  catch(error) {
    testResults['consumer'][options.test] = { 'earl:outcome': 'earl:failed', 'earl:info': 'Malformed JSON.' };
    return Promise.resolve(testResults);
  }

  return getGraphFromData(options.data, o).then(
    function(g){
      var matchedStatements = g.match(options.subject, options.property, options.object).toArray();
      if(matchedStatements.length == 1) {
        testResults['consumer'][options.test] = { 'earl:outcome': 'earl:passed', 'earl:info': '' };
      }
      else {
        testResults['consumer'][options.test] = { 'earl:outcome': 'earl:failed', 'earl:info': 'Tested pattern not found.' };
      }
      return Promise.resolve(testResults);
    },
    function(reason){
      testResults['consumer'][options.test] = { 'earl:outcome': 'earl:failed', 'earl:info': 'Unable to parse as JSON-LD.' };
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
              <p>Due to the nature of consumers, gathering results for these tests is manual. The form below links to several <em>targets</em>. Set your consumer to run against each of these, inspect the results (either through your softwares UI, logs, or commandline interface), and input them into the form. You will have a chance to review before submitting a report for your implementation. Reports will be submitted to an <a about="" rel="ldp:inbox" href="reports/">inbox</a> and can be retrieved.</p>

              <p>If your consumer implementation is not able to process the particular vocabulary one of the test notifications, you can leave that untested. If your consumer cannot process <em>any</em> of them, open a <a href="http://github.com/csarven/ldn-tests/issues/">GitHub issue</a> with a sample that you can process, and we'll add it.</p>
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
              <form action="#test-response" class="form-tests" id="test-consumer" method="post">
                <fieldset>
                  <legend>Test Consumer</legend>
                  <ul>
                    <li>
                      <p>URL of the Inbox from <a href="discover-inbox-link-header">target A</a> (in header):</p>
                      <label for="test-consumer-discover-inbox-link-header">URL</label>
                      <input type="text" name="test-consumer-discover-inbox-link-header" value="" placeholder="Include only the URL" />
                    </li>
                    <li>
                      <p>URL of the Inbox from <a href="discover-inbox-rdf-body">target B</a> (in RDF body):</p>
                      <label for="test-consumer-discover-inbox-rdf-body">URL</label>
                      <input type="text" name="test-consumer-discover-inbox-rdf-body" value="" placeholder="Include only the URL" />
                    </li>
                    <li>
                      <p>URLs of the notifications in <a href="discover-inbox-link-header">target A</a>'s Inbox (JSON-LD compacted):</p>
                      <label for="test-consumer-inbox-compacted">URLs</label>
                      <input type="text" name="test-consumer-inbox-compacted" value="" placeholder="Separated by a space" />
                    </li>
                    <li>
                      <p>URLs of the notifications in <a href="discover-inbox-rdf-body">target B</a>'s Inbox (JSON-LD expanded):</p>
                      <label for="test-consumer-inbox-expanded">URLs</label>
                      <input type="text" name="test-consumer-inbox-expanded" value="" placeholder="Separated by a space" />
                    </li>
                  </ul>

                  <p>For the folowing tests, input the values using the JSON-LD serialization:</p>
                  <ul>
                    <li>
                      <label for="test-inbox-compacted-announce">Contents of the <samp>announce</samp> notification discovered from <a href="discover-inbox-link-header">target A</a>'s Inbox</label>
                      <textarea name="test-inbox-compacted-announce" cols="80" rows="3"></textarea>
                    </li>
                    <li>
                      <label for="test-inbox-compacted-changelog">Contents of the <samp>changelog</samp> notification discovered from <a href="discover-inbox-link-header">target A</a>'s Inbox</label>
                      <textarea name="test-inbox-compacted-changelog" cols="80" rows="3"></textarea>
                    </li>
                    <li>
                      <label for="test-inbox-compacted-citation">Contents of the <samp>citation</samp> notification discovered from <a href="discover-inbox-link-header">target A</a>'s Inbox</label>
                      <textarea name="test-inbox-compacted-citation" cols="80" rows="3"></textarea>
                    </li>
                    <li>
                      <label for="test-inbox-expanded-assessing">Contents of the <samp>assessing</samp> notification discovered from <a href="discover-inbox-rdf-body">target B</a>'s Inbox</label>
                      <textarea name="test-inbox-expanded-assessing" cols="80" rows="3"></textarea>
                    </li>
                    <li>
                      <label for="test-inbox-expanded-comment">Contents of the <samp>comment</samp> notification discovered from <a href="discover-inbox-rdf-body">target B</a>'s Inbox</label>
                      <textarea name="test-inbox-expanded-comment" cols="80" rows="3"></textarea>
                    </li>
                    <li>
                      <label for="test-inbox-expanded-rsvp">Contents of the <samp>rsvp</samp> notification discovered from <a href="discover-inbox-rdf-body">target B</a>'s Inbox</label>
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
