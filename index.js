var fs = require('fs');
var etag = require('etag');
var uuid = require('node-uuid');
var btoa = require("btoa");
var atob = require("atob");
var mayktso = require('mayktso');

var config = mayktso.config();
mayktso.init({'config': config, 'omitRoutes': ['/receiver', '/send-report', '/view-reports', '/media']});

mayktso.app.use('/media', mayktso.express.static(__dirname + '/media'));
mayktso.app.route('/receiver').all(testResource);
mayktso.app.route('/send-report').all(reportTest);
mayktso.app.route('/summary').all(showSummary);
//console.log(mayktso.app._router.stack);

var getResource = mayktso.getResource;
var getResourceHead = mayktso.getResourceHead;
var getResourceOptions = mayktso.getResourceOptions;
var postResource = mayktso.postResource;
var htmlEntities = mayktso.htmlEntities;
var vocab = mayktso.vocab;
var getGraph = mayktso.getGraph;
var getGraphFromData = mayktso.getGraphFromData;
var serializeData = mayktso.serializeData;
var SimpleRDF = mayktso.SimpleRDF;
var RDFstore = mayktso.RDFstore;
var parseLinkHeader = mayktso.parseLinkHeader;
var parseProfileLinkRelation = mayktso.parseProfileLinkRelation;
var getBaseURL = mayktso.getBaseURL;
var XMLHttpRequest = mayktso.XMLHttpRequest;
var discoverInbox = mayktso.discoverInbox;
var getInboxNotifications = mayktso.getInboxNotifications;

var ldnTests = {
  'sender': {},
  'receiver': {
    'checkHead': {
      'description': 'Accepts <code>HEAD</code> requests.'
    },

    'checkOptions': {
      'description': 'Accepts <code>OPTIONS</code> requests.'
    },
    'checkOptionsAcceptPost': {
      'description': 'Advertises acceptable content types with <code>Accept-Post</code> in response to <code>OPTIONS</code> request.'
    },
    'checkOptionsAcceptPostContainsJSONLD': {
      'description': '<code>Accept-Post</code> includes <code>application/ld+json</code>.'
    },

    'checkPost': {
      'description': 'Accepts <code>POST</code> requests.'
    },
    'checkPostResponseCreated': {
      'description': 'Responds to <code>POST</code> requests with <code>Content-Type: application/ld+json</code> with status code <code>201 Created</code> or <code>202 Accepted</code>.'
    },
    'checkPostResponseLocation': {
      'description': 'Returns a <code>Location</code> header in response to successful <code>POST</code> requests.'
    },
    'checkPostResponseProfileLinkRelationAccepted': {
      'description': 'Succeeds when the content type includes a <code>profile</code> parameter.'
    },
    // 'checkPostResponseBody': {
    //   'description': 'TODO: Read the body'
    // },
    'checkPostResponseConstraintsUnmet': {
      'description': 'Fails to process notifications if implementation-specific constraints are not met.'
    },

    'checkGet': {
      'description': 'Returns JSON-LD on <code>GET</code> requests.',
    },
    'checkGetResponseLDPContains': {
      'description': 'Lists notification URIs with <code>ldp:contains</code>.'
    },
    'checkGetResponseNotificationsLimited': {
      'description': 'Restricts list of notification URIs (eg. according to access control).'
    },
    'checkGetResponseNotificationsJSONLD': {
      'description': 'Notifications are available as JSON-LD.'
    },
    'checkGetResponseNotificationsRDFSource': {
      'description': 'When requested with no <code>Accept</code> header or <code>*/*</code>, notifications are still returned as RDF.'
    },
    'extraCheckGetResponseLDPContainer': {
      'description': 'Inbox has type <code>ldp:Container</code>.'
    },
    'extraCheckGetResponseLDPConstrainedBy': {
      'description': 'Advertises constraints with <code>ldp:constrainedBy</code>.'
    }
  },

  'consumer': {}
}

function testResource(req, res, next){
// console.log(req.requestedPath);
// console.log(req);

  switch(req.method){
    case 'GET':
      if(!req.accepts(['text/html', '*/*'])) {
        res.status(406);
        res.end();
        return next();
      }

      var data = getTestReceiverHTML();

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

            var reportHTML = getTestReportHTML(resultsData);
            var test = {'url': req.body['test-receiver-url'] };
            test['results'] = resultsData;

            resultsData['test-receiver-report-html'] = `
    <div id="test-receiver-response">
      <table id="test-receiver-report">
        <caption>Test results for <a href="${test['url']}">${test['url']}</a></caption>
        <thead><tr><th>Result</th><th>Test</th><th>Notes</th></tr></thead>
        <tfoot><tr><td colspan="4">
          <dl>
            <dt class="test-PASS"><abbr title="Pass">✔</abbr></dt><dd>Pass</dd>
            <dt class="test-FAIL"><abbr title="Fail">✗</abbr></dt><dd>Fail</dd>
            <dt class="test-NA"><abbr title="Not applicable">-</abbr></dt><dd>Not applicable</dd>
          </dl>
        </td></tr></tfoot>
        <tbody>
${reportHTML}
        </tbody>
      </table>
      <form action="send-report" class="test-receiver" id="test-receiver-report" method="post">
        <fieldset>
          <legend>LDN Report</legend>
          <ul>
            <li>
              <label for="implementation">Implementation</label>
              <input type="text" name="implementation" value="" placeholder="URI of the project/implementation." /> (required)
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

          <input type="hidden" name="test-receiver-report-value" value="${btoa(JSON.stringify(test))}" />
          <input type="submit" value="Send Report" />
        </fieldset>
      </form>
    </div>`;

            var data = getTestReceiverHTML(req.body, resultsData);
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
        testResults['receiver']['checkOptions'] = { 'code': 'PASS', 'message': '' };
        if(acceptPost){
          testResults['receiver']['checkOptionsAcceptPost'] = { 'code': 'PASS', 'message': '<code>Accept-Post: ' + acceptPost + '</code>' };

          var acceptPosts = acceptPost.split(',');
          testResults['receiver']['checkOptionsAcceptPostContainsJSONLD'] = { 'code': 'FAIL', 'message': '<code>Accept-Post: ' + acceptPost + '</code>' };
          acceptPosts.forEach(function(i){
            var m = i.trim();
            if(m == 'application/ld+json' || m == '*/*'){
              testResults['receiver']['checkOptionsAcceptPostContainsJSONLD'] = { 'code': 'PASS', 'message': '' };
            }
          })
        }
        else {
          testResults['receiver']['checkOptionsAcceptPost'] = { 'code': 'FAIL', 'message': '<code>Accept-Post: ' + acceptPost + '</code>' };
        }
      return Promise.resolve(testResults);
    },
    function(reason){
      testResults['receiver']['checkOptions'] = { 'code': 'NA', 'message': '<code>HTTP ' + reason.xhr.status + '</code>' };
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
      testResults['receiver']['checkHead'] = { 'code': 'PASS', 'message': '' };
      return Promise.resolve(testResults);
    },
    function(reason){
      testResults['receiver']['checkHead'] = { 'code': 'NA', 'message': '<code>HTTP ' + reason.xhr.status + '</code>' };
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
      testResults['receiver']['checkGetResponseNotificationsLimited'] = { 'code': 'NA', 'message': 'Check manually.' };

      var data = response.xhr.responseText;
      var contentType = response.xhr.getResponseHeader('Content-Type');
// console.log(contentType);
      if(typeof contentType == undefined){
          testResults['receiver']['checkGet'] = { 'code': 'FAIL', 'message': 'No <code>Content-Type</code>. Inbox can not be parsed as <code>' + headers['Accept'] + '</code>.' };
          return Promise.resolve(testResults);
      }
      else if(contentType.split(';')[0].trim() != headers['Accept']) {
          testResults['receiver']['checkGet'] = { 'code': 'FAIL', 'message': '<code>Content-Type: ' + contentType + '</code> returned. Inbox can not be parsed as <code>' + headers['Accept'] + '</code>.'};
          return Promise.resolve(testResults);
      }
      else {
        testResults['receiver']['checkGet'] = { 'code': 'PASS', 'message': '' };
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

              testResults['receiver']['extraCheckGetResponseLDPContainer'] = { 'code': 'PASS', 'message': 'Found in <code>Link</code> header: ' + rdftypes.join(', ') };
            }
            else if(resourceTypes.indexOf(vocab.ldpcontainer["@id"]) > -1 || resourceTypes.indexOf(vocab.ldpbasiccontainer["@id"]) > -1) {
              resourceTypes.forEach(function(url){
                if(url == vocab.ldpcontainer["@id"] || url == vocab.ldpbasiccontainer["@id"]) {
                  rdftypes.push('<a href="' + url + '">' + url + '</a>');
                }
              });

              testResults['receiver']['extraCheckGetResponseLDPContainer'] = { 'code': 'PASS', 'message': 'Found in body: ' + rdftypes.join(', ') };
            }
            else {
              testResults['receiver']['extraCheckGetResponseLDPContainer'] = { 'code': 'NA', 'message': 'Not found.' };
            }

            if (vocab['ldpconstrainedBy']['@id'] in linkHeaders && linkHeaders[vocab['ldpconstrainedBy']['@id']].length > 0) {
              var constrainedBys = [];
              linkHeaders[vocab['ldpconstrainedBy']['@id']].forEach(function(url){
                constrainedBys.push('<a href="' + url + '">' + url + '</a>');
              });

              testResults['receiver']['extraCheckGetResponseLDPConstrainedBy'] = { 'code': 'PASS', 'message': 'Found: ' + constrainedBys.join(', ') };
            }
            else {
              testResults['receiver']['extraCheckGetResponseLDPConstrainedBy'] = { 'code': 'NA', 'message': 'Not found.' };
            }

            var notifications = [];
            s.ldpcontains.forEach(function(resource) {
                notifications.push(resource.toString());
            });

            if(notifications.length > 0) {
              testResults['receiver']['checkGetResponseLDPContains'] = { 'code': 'PASS', 'message': 'Found ' + notifications.length + ' notifications.' };

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
                          resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'code': 'FAIL', 'message': anchor + ': <code>Accept: ' + acceptValue + '</code> != <code>Content-Type: ' + cT + '</code>' });
                        }
                        else {
                          var options = { 'subjectURI': '_:ldn' }
                          var codeAccept = (acceptValue == '') ? 'No <code>Accept</code>' : '<code>Accept: ' + acceptValue + '</code>';
                          serializeData(data, contentType, 'application/ld+json', options).then(
                            function(i){
                              resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'code': 'PASS', 'message': anchor + ': ' + codeAccept + ' => <code>Content-Type: ' + cT + '</code> <em>can</em> be serialized as JSON-LD' });
                            },
                            function(reason){
                              resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'code': 'FAIL', 'message': anchor + ': ' + codeAccept + ' => <code>Content-Type: ' + cT + '</code> <em>can not</em> be serialized as JSON-LD' });
                            }
                          );
                        }
                      }
                      else {
                        resolve({ 'url': url, 'Accept': acceptValue, 'Content-Type': cT, 'code': 'FAIL', 'message': anchor + ': HTTP status ' + this.status });
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
                  var codeJSONLD = 'PASS';
                  var codeRDFSource = 'PASS';
                  results.forEach(function(r){
                    if(r['Accept'] == 'application/ld+json'){
                      if (r.code == 'FAIL') { codeJSONLD = 'FAIL'; }
                      notificationStateJSONLD.push(r.message);
                    }
                    else {
                      if (r.code == 'FAIL') { codeRDFSource = 'FAIL'; }
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
              testResults['receiver']['checkGetResponseLDPContains'] = { 'code': 'NA', 'message': 'Did not find <code>ldp:contains</code>. It may because there are no notifications yet.' };
              return Promise.resolve(testResults);
            }
          },
          function(reason){
console.log(reason);
            testResults['receiver']['checkGet'] = { 'code': 'FAIL', 'message': 'Inbox can not be parsed as <code>' + headers['Accept'] + '</code>.' };
            return Promise.resolve(testResults);
          });
      }
    },
    function(reason){
// console.log(reason);
      var code = 'FAIL';
      if(typeof reason.xhr.status !== 'undefined' && reason.xhr.status >= 400 && reason.xhr.status < 500) { //HTTP 4xx
        code = 'PASS';
      }

      testResults['receiver']['checkGet'] = { 'code': code, 'message': '<code>HTTP '+ reason.xhr.status + '</code>, <code>Content-Type: ' + reason.xhr.getResponseHeader('Content-Type') + '</code>' };
      return Promise.resolve(testResults);
    });
}



function checkPost(req){
  var testResults = { 'receiver': {} };
  var headers = {};
  headers['Content-Type'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json; profile="http://example.org/profile"; charset=utf-8';
  var data = ('test-receiver-data' in req.body && req.body['test-receiver-data'].length > 0) ? req.body['test-receiver-data'] : '';
  var url = req.body['test-receiver-url'];
// console.log('checkGet: ' + url);
  return postResource(url, '', data, headers['Content-Type']).then(
    function(response){
console.log(response);
      // POST requests are supported, with and without profiles
      testResults['receiver']['checkPost'] = { 'code': 'PASS', 'message': '<code>HTTP ' + response.xhr.status + '</code>' };
      testResults['receiver']['checkPostResponseProfileLinkRelationAccepted'] = { 'code': 'PASS', 'message': '' };

      // If 201 or 202
      if(response.xhr.status == 201 || response.xhr.status == 202) {
        // If 'reject' was ticked, creating was wrong, fail
        if('test-receiver-reject' in req.body){
          testResults['receiver']['checkPostResponseCreated'] = { 'code' : 'FAIL', 'message' : 'Payload did NOT meet constraints, but the receiver indicated success (<code>' + response.xhr.status + '</code>)' };
          testResults['receiver']['checkPostResponseConstraintsUnmet'] = { 'code': 'FAIL', 'message': '' };
          return Promise.resolve(testResults);

        // Otherwise, pass
        }
        else{
          testResults['receiver']['checkPostResponseCreated'] = { 'code': 'PASS', 'message': '<code>HTTP ' + response.xhr.status + '</code>' };

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
                  testResults['receiver']['checkPostResponseLocation'] = { 'code': 'PASS', 'message': '<code>Location</code>: <a href="' + url + '">' + url + '</a> found and can be retrieved.' };
                  return Promise.resolve(testResults);
                },
                function(j){
// console.log(j);
                  testResults['receiver']['checkPostResponseLocation'] = { 'code': 'FAIL', 'message': '<code>Location</code>: <a href="' + url + '">' + url + '</a> found but can not be retrieved: <code>HTTP ' + j.xhr.status + '</code> <q>' + j.xhr.responseText + '</q>' };
                  return Promise.resolve(testResults);
                });
            }
            else {
              testResults['receiver']['checkPostResponseLocation'] = { 'code': 'FAIL', 'message': '<code>Location</code> header not found.' };
              return Promise.resolve(testResults);
            }
          }
        }
      }
      else {
        testResults['receiver']['checkPost'] = { 'code': 'FAIL', 'message': 'Response was <code>HTTP ' + response.xhr.status + '</code>. Should return <code>HTTP 201</code>.'};
        return Promise.resolve(testResults);
      }
    },
    function(reason){
console.log(reason);
      testResults['receiver']['checkPost'] = { 'code': 'FAIL', 'message': '<code>HTTP ' + reason.xhr.status + '</code>: <q>' + reason.xhr.responseText + '</q>'};
      switch(reason.xhr.status){
        case 400:
          if('test-receiver-reject' in req.body) {
            testResults['receiver']['checkPost'] = { 'code': 'PASS', 'message': 'Deliberately rejected (<code>HTTP ' + reason.xhr.status + '</code>)' };
            testResults['receiver']['checkPostResponseConstraintsUnmet'] = { 'code': 'PASS', 'message': 'Payload successfully filtered out (<code>HTTP ' + reason.xhr.status + '</code>)' };
          }
          //TODO: Maybe handle other formats here
          if(headers['Content-Type'] == 'application/ld+json'){ //TODO: && payload format is valid
            testResults['receiver']['checkPostResponseCreated'] = { 'code': 'FAIL', 'message': '<em class="rfc2119">MUST</em> accept notifications where the request body is JSON-LD, with the <code>Content-Type: application/ld+json</code>' };
          }
          break;
        case 405:
          testResults['receiver']['checkPost'] = { 'code': 'FAIL', 'message': '<em class="rfc2119">MUST</em> support <code>POST</code> request on the Inbox URL.' };
          break;
        case 415:
          if('test-receiver-reject' in req.body) {
            testResults['receiver']['checkPost'] = { 'code': 'PASS', 'message': '<code>HTTP ' + reason.xhr.status + '</code>. Request with <code>Content-Type: ' + headers['Content-Type'] + '</code> has been rejected.' };
          }
          else {
            testResults['receiver']['checkPost'] = { 'code': 'FAIL', 'message': '<code>HTTP ' + reason.xhr.status + '</code>. Request with <code>Content-Type: ' + headers['Content-Type'] + '</code> is not allowed, or the payload does not correspond to this content-type. Check the payload syntax is valid, and make sure that the receiver is not having trouble with the <code>profile</code> or <code>charset</code> parameter.</code>.' };
          }
          testResults['receiver']['checkPostResponseProfileLinkRelationAccepted'] = { 'code': 'NA', 'message': 'The request was possibly rejected due to the <q>profile</q> Link Relation. If the mediatype is recognised, it may be better to accept the request by ignoring the profile parameter.' };
          break;
        default:
          testResults['receiver']['checkPost'] = { 'code': 'FAIL', 'message': '<code>HTTP ' + reason.xhr.status + '</code>: <q>' + reason.xhr.responseText + '</q>'};
          break;
      }

      return Promise.resolve(testResults);
    });
}



function getTestReportHTML(test, implementation){
  var s = [];
  implementation = implementation || 'receiver';

  Object.keys(ldnTests[implementation]).forEach(function(id){
    var testResult = '';

    if(typeof test[id] == 'undefined'){
      test[id] = { 'code': 'NA', 'message': '' };
    }

    switch(test[id]['code']){
      default: testResult = test[id]['code']; break;
      case 'PASS': testResult = '✔'; break;
      case 'FAIL': testResult = '✗'; break;
      case 'NA': testResult = '-'; break;
    }

    s.push('<tr id="test-' + id + '"><td class="test-result test-' + test[id]['code'] + '">' + testResult + '</td><td class="test-description">' + ldnTests[implementation][id]['description'] + '</td><td class="test-message">' + test[id]['message'] + '</td></tr>');
  });

  return s.join("\n");
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

function getTestReceiverHTML(request, results){
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
        <link href="https://dokie.li/media/css/basic.css" media="all" rel="stylesheet" title="Basic" />
        <link href="media/css/ldntests.css" media="all" rel="stylesheet" />
    </head>

    <body about="" prefix="rdf: http://www.w3.org/1999/02/22-rdf-syntax-ns# rdfs: http://www.w3.org/2000/01/rdf-schema# owl: http://www.w3.org/2002/07/owl# xsd: http://www.w3.org/2001/XMLSchema# dcterms: http://purl.org/dc/terms/ dctypes: http://purl.org/dc/dcmitype/ foaf: http://xmlns.com/foaf/0.1/ v: http://www.w3.org/2006/vcard/ns# pimspace: http://www.w3.org/ns/pim/space# cc: http://creativecommons.org/ns# skos: http://www.w3.org/2004/02/skos/core# prov: http://www.w3.org/ns/prov# qb: http://purl.org/linked-data/cube# schema: https://schema.org/ rsa: http://www.w3.org/ns/auth/rsa# cert: http://www.w3.org/ns/auth/cert# cal: http://www.w3.org/2002/12/cal/ical# wgs: http://www.w3.org/2003/01/geo/wgs84_pos# org: http://www.w3.org/ns/org# biblio: http://purl.org/net/biblio# bibo: http://purl.org/ontology/bibo/ book: http://purl.org/NET/book/vocab# ov: http://open.vocab.org/terms/ sioc: http://rdfs.org/sioc/ns# doap: http://usefulinc.com/ns/doap# dbr: http://dbpedia.org/resource/ dbp: http://dbpedia.org/property/ sio: http://semanticscience.org/resource/ opmw: http://www.opmw.org/ontology/ deo: http://purl.org/spar/deo/ doco: http://purl.org/spar/doco/ cito: http://purl.org/spar/cito/ fabio: http://purl.org/spar/fabio/ oa: http://www.w3.org/ns/oa# as: http://www.w3.org/ns/activitystreams# ldp: http://www.w3.org/ns/ldp# solid: http://www.w3.org/ns/solid/terms# earl: https://www.w3.org/ns/earl#" typeof="schema:CreativeWork sioc:Post prov:Entity">
        <main>
            <article about="" typeof="schema:Article">
                <h1 property="schema:name">LDN Tests for Receivers</h1>

                <div id="content">
                    <section id="receiver" inlist="" rel="schema:hasPart" resource="#receiver">
                        <h2 property="schema:name">Receiver</h2>
                        <div datatype="rdf:HTML" property="schema:description">
                            <p>This form is to test implementations of LDN receivers. Input the URL of an Inbox, and when you submit, it fires off several HTTP requests with the various combinations of parameters and headers that you are required to support in order for senders to create new notifications and consumers to retreive them. It returns a <span class="test-PASS">pass</span>/<span class="test-FAIL">fail</span> response for individual requirements of the LDN spec. It also tests some optional features; you'll get a <span class="test-NA">not applicable</span> response if you don't implement them, rather than a fail.</p>
                            <p>We provide a default notification payload, but if you have a specilised implementation you may want to modify this to your needs.</p>
                            <p>If your receiver is setup to reject certain payloads (LDN suggests you implement some kinds of constraints or filtering), you can input one such payload and check the <q>Receiver should reject this notification</q> box. If your receiver rejects the POST requests, you will <em>pass</em> the relevant tests.</p>
                            <p>Reports will be submitted to an <a about="" rel="ldp:inbox" href="reports/">inbox</a>.</p>

                            <form action="" class="test-receiver" id="test-receiver" method="post">
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
${(results && 'test-receiver-report-html' in results) ? results['test-receiver-report-html'] : ''}
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


function createReceiverTestReport(req, res, next){
  var test = JSON.parse(atob(req.body['test-receiver-report-value']));
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
  }
  else {
    res.status(400);
    res.end();
    return next();
  }

  var doap = `<${implementation}>
  a doap:Project, ldn:Receiver;
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

    var earlResult = "inapplicable";
    if(test['results'][i]['code'] == "PASS"){
      earlResult = "passed";
    }else if(test['results'][i]['code'] == "FAIL"){
      earlResult = "failed";
    }
    // TODO: for things that say 'check manually' should be earl:untested or earl:canttell

    var observation = `d:${i}
  a qb:Observation, earl:Assertion;
  qb:dataSet <>;
  earl:subject <${implementation}>;
  earl:test ldnTests:${i};
  earl:result d:${i}-result .\n`;

    observation += `d:${i}-result
  earl:outcome earl:${earlResult}`;
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


function reportTest(req, res, next){
  if(req.method == 'POST') {
    var data = '', test = {};
    if(req.body['test-receiver-report-value'] && req.body['test-receiver-report-value'].length > 0){
      test = JSON.parse(atob(req.body['test-receiver-report-value']));
      data = createReceiverTestReport(req, res, next);
    }

    var headers = {};
    headers['Content-Type'] = 'text/turtle;charset=utf-8';

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
console.log(notifications)
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
          var a = [];
          // s.forEach(function(g){
          //   var observationUris = g.rdfsseeAlso;

          //   observationUris.forEach(function(observationUri){
          //     var observationGraph = g.child(observationUri);
          //     var implementationGraph = observationGraph['https://www.w3.org/ns/earl#subject'];
          //     var resultGraph = observationGraph['https://www.w3.org/ns/earl#result'];
          //     // var testGraph = observationGraph['https://www.w3.org/ns/earl#test'];
          //     console.log(implementationGraph.toString());
          //   });

          // });
          var string = a.join('<hr />');

          var data = getReportsHTML(string);
///


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

function getReportsHTML(data){

    var rTestsCount = Object.keys(ldnTests['receiver']).length;
    var cTestsCount = Object.keys(ldnTests['consumer']).length;
    var sTestsCount = Object.keys(ldnTests['sender']).length;
    var implCount = 8;

    var trs = '<tr>';
    for(var i=0;i<implCount;i=i+1){
      trs = trs + '  <th>imp ${i}</th>';
    }
    trs = trs + '</tr>';

    var first = true;
    Object.keys(ldnTests['receiver']).forEach(function(test){
      trs = trs + '<tr>';
      if(first){
        trs = trs + '  <td rowspan="' + rTestsCount + '">R</td>';
      }
      trs = trs + '  <td>' + test + '</td>';
      for(var i=0;i<implCount;i=i+1){
        trs = trs + ' <td>x</td>';
      }
      trs = trs + '</tr>';
      first = false;
    });

    return `<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta charset="utf-8" />
        <title>LDN Test Reports</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="https://dokie.li/media/css/basic.css" media="all" rel="stylesheet" title="Basic" />
        <link href="media/css/ldntests.css" media="all" rel="stylesheet" />
    </head>

    <body about="" prefix="rdf: http://www.w3.org/1999/02/22-rdf-syntax-ns# rdfs: http://www.w3.org/2000/01/rdf-schema# owl: http://www.w3.org/2002/07/owl# xsd: http://www.w3.org/2001/XMLSchema# dcterms: http://purl.org/dc/terms/ dctypes: http://purl.org/dc/dcmitype/ foaf: http://xmlns.com/foaf/0.1/ v: http://www.w3.org/2006/vcard/ns# pimspace: http://www.w3.org/ns/pim/space# cc: http://creativecommons.org/ns# skos: http://www.w3.org/2004/02/skos/core# prov: http://www.w3.org/ns/prov# qb: http://purl.org/linked-data/cube# schema: https://schema.org/ rsa: http://www.w3.org/ns/auth/rsa# cert: http://www.w3.org/ns/auth/cert# cal: http://www.w3.org/2002/12/cal/ical# wgs: http://www.w3.org/2003/01/geo/wgs84_pos# org: http://www.w3.org/ns/org# biblio: http://purl.org/net/biblio# bibo: http://purl.org/ontology/bibo/ book: http://purl.org/NET/book/vocab# ov: http://open.vocab.org/terms/ sioc: http://rdfs.org/sioc/ns# doap: http://usefulinc.com/ns/doap# dbr: http://dbpedia.org/resource/ dbp: http://dbpedia.org/property/ sio: http://semanticscience.org/resource/ opmw: http://www.opmw.org/ontology/ deo: http://purl.org/spar/deo/ doco: http://purl.org/spar/doco/ cito: http://purl.org/spar/cito/ fabio: http://purl.org/spar/fabio/ oa: http://www.w3.org/ns/oa# as: http://www.w3.org/ns/activitystreams# ldp: http://www.w3.org/ns/ldp# solid: http://www.w3.org/ns/solid/terms#" typeof="schema:CreativeWork sioc:Post prov:Entity">
        <main>
            <article about="" typeof="schema:Article">
                <h1 property="schema:name">LDN Test Reports</h1>

                <div id="content">
                  <table>
                    <tr>
                      <th colspan="2" rowspan="2">Test</th>
                      <th colspan="${implCount}">Implementations</th>
                    </tr>
${trs}
                  </table>
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
