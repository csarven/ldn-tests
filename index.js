var fs = require('fs');
var etag = require('etag');
//var bodyParser = require('body-parser');
var mayktso = require('mayktso');

mayktso.init();

mayktso.app.route('/receiver').all(testResource);
//console.log(mayktso.app._router.stack);
var getResource = mayktso.getResource;
var getResourceHead = mayktso.getResourceHead;
var getResourceOptions = mayktso.getResourceOptions;
var postResource = mayktso.postResource;
var htmlEntities = mayktso.htmlEntities;

var ldnTests = {
  'sender': {},
  'receiver': {
    '1': { 'description': '<em class="rfc2119">MUST</em> support <code>GET</code> request on the Inbox URL.', 'function': checkGet  },
    '2': { 'description': '<em class="rfc2119">MUST</em> support <code>POST</code> request on the Inbox URL.', 'function': checkPost },
    '3': { 'description': '<em class="rfc2119">MUST</em> respond with status code <code>201 Created</code>', 'function': checkPostResponseCreated  },
    '4': { 'description': '<code>Location</code> header set to the URL from which the notification data can be retrieved.', 'function': checkPostResponseLocation },
    '5': { 'description': 'If the request was queued to be processed asynchronously, the receiver <em class="rfc2119">MUST</em> respond with a status code of <code>202 Accepted</code> and include information about the status of the request in the body of the response.', 'function': checkPostResponseAccepted  },
    '6': { 'description': 'constraints on the notifications <em class="rfc2119">SHOULD</em> fail to process the notification if the constraints are not met and return the appropriate <code>4xx</code> error code.', 'function': ''  },
    '7': { 'description': '<em class="rfc2119">MUST</em> accept notifications where the request body is JSON-LD, with the <code>Content-Type: application/ld+json</code>', 'function': '' },
    '8': { 'description': '<li>...which <em class="rfc2119">MAY</em> include a <code>profile</code> URI', 'function': ''  },
    '9': { 'description': '<em class="rfc2119">MAY</em> accept other RDF content types (e.g., <code>text/turtle</code>, <code>text/html</code>), and if so, <em class="rfc2119">SHOULD</em> advertise the content types they accept with an <code>Accept-Post</code> header in response to an <code>OPTIONS</code> request on the Inbox URL.', 'function': ''  },
    '10': { 'description': 'A successful <code>GET</code> request on the Inbox <em class="rfc2119">MUST</em> return a <code>HTTP 200 OK</code> with the URIs of notifications, subject to the requester’s access (returning <code>4xx</code> error codes as applicable).', 'function': checkOptions  },
    '11': { 'description': 'Receivers <em class="rfc2119">MAY</em> list only URIs of notifications in the Inbox that the consumer is able to access.', 'function': ''  },
    '12': { 'description': 'Each notification URI <em class="rfc2119">MUST</em> be related to the Inbox URL with the <code>http://www.w3.org/ns/ldp#contains</code> predicate.', 'function': ''  },
    '13': { 'description': 'Each notification <em class="rfc2119">MUST</em> be an <a href="http://www.w3.org/TR/rdf11-concepts/#dfn-rdf-source">RDF source</a>.', 'function': ''  },
    '14': { 'description': 'The JSON-LD content type <em class="rfc2119">MUST</em> be available for all resources' , 'function': ''  },
    '15': { 'description': '...but clients may send <code>Accept</code> headers preferring other content types (<a href="#bib-rdfc7231">RFC7231</a> Section 3.4 - Content Negotiation). If the client sends no <code>Accept</code> header, the server may send the data in JSON-LD or any format which faithfully conveys the same information (e.g., Turtle).', 'function': ''  },
    '16': { 'description': 'Any additional description about the Inbox itself <em class="rfc2119">MAY</em> also be returned (e.g., <a href="#constraints">Constraints</a>).', 'function': ''  },
    '17': { 'description': 'Inbox is an <code>ldp:Container</code>', 'function': ''  },
    '18': { 'description': 'Inbox accepts <code>HEAD</code> requests', 'function': checkHead }
  },
  'consumer': {}
}

var receiverMethods = ['OPTIONS', 'HEAD', 'GET', 'POST'];

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

      receiverMethods.forEach(function(testMethod) {
        if(req.body['test-receiver-url'] && (req.body['test-receiver-url'].toLowerCase().slice(0,7) == 'http://' || req.body['test-receiver-url'].toLowerCase().slice(0,8) == 'https://')) {

          testReceiverPromises.push(testReceiverMethod(testMethod, req));
        }
      });

      Promise.all(testReceiverPromises)
        .then((results) => {
console.dir(results);

          var reportHTML = [];
          results.forEach(function(tr){
            reportHTML.push(tr['test-receiver-report-html']);
          })

          results['test-receiver-response-html'] = `
<div id="test-receiver-response">
  <table id="test-receiver-report">
    <caption>Test results</caption>
    <thead><tr><th>Id</th><th>Result</th><th>Description</th></tr></thead>
    <tfoot><tr><td colspan="3">
      <dl>
        <dt><abbr title="Pass">✔</abbr></dt><dd>Pass</dd>
        <dt><abbr title="Fail">✗</abbr></dt><dd>Fail</dd>
        <dt><abbr title="Not applicable">NA</abbr></dt><dd>Not applicable</dd>
      </dl>
    </td></tr></tfoot>
    <tbody>
${reportHTML.join("\n")}
    </tbody>
  </table>
</div>`;
// console.log(results['test-receiver-response-html']);

          var data = getTestReceiverHTML(req.body, results);
// console.log(data);

          res.set('Content-Type', 'text/html;charset=utf-8');
          res.set('Allow', 'GET, POST');
          res.status(200);
          res.send(data);

         return next();
        })
        .catch((e) => {
          console.log('--- catch ---');
          console.log(e);
        });
      break;

    default:
      res.status(405);
      res.set('Allow', 'GET, POST');
      res.end();
      return next();
      break;
  }
}

function testReceiverMethod(method, req) {
// console.log('------ testReceiverMethod: ' + method);
// console.log(req.body);

  return new Promise(function(resolve, reject) {
    var headers = {}, data, request, results = {};

    switch(method){
      case 'GET': case 'HEAD': case 'OPTIONS': default:
        headers['Accept'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
// console.log(headers);

        switch(method){
          case 'GET': default:
            request = getResource(req.body['test-receiver-url'], headers);
            break;
          case 'HEAD':
            request = getResourceHead(req.body['test-receiver-url'], headers);
            break;
          case 'OPTIONS':
            request = getResourceOptions(req.body['test-receiver-url'], headers);
            break;
        }

        request
          .then(function(response){
//console.log(response);
            results['test-receiver-response'] = response;
            results['test-receiver-report'] = getTestReport(req, response);
            results['test-receiver-report-html']  = getTestReportHTML(results['test-receiver-report']);
// console.log(results);

            return resolve(results);
          })
          .catch(function(reason){
            console.log('Error:');
            console.log(reason);
          });

        break;

      case 'POST':
        headers['Content-Type'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
        data = ('test-receiver-data' in req.body && req.body['test-receiver-data'].length > 0) ? req.body['test-receiver-data'] : '';

        postResource(req.body['test-receiver-url'], '', data, headers['Content-Type'])
          .then(function(response){
//console.log(response.xhr);

            results['test-receiver-response'] = response;
            results['test-receiver-report'] = getTestReport(req, response);
            results['test-receiver-report-html']  = getTestReportHTML(results['test-receiver-report']);
// console.log(results);

            return resolve(results);
          })
          .catch(function(reason){
            console.log('--- catch POST ' + test-receiver-url);
            console.dir(reason);
          });

        break;
    }

  });
}

function getTestReport(req, response) {
  var r = {};
  var checkTests = [];
  var implementations = ['sender', 'receiver', 'consumer'];
  var implementation = ('test-implementation' in req.body && implementations.indexOf(req.body['test-implementation']) > -1) ? req.body['test-implementation'] : undefined;

  if (!implementation) { console.log('--- getTestReport: Invalid test implementation'); return; }

  r[implementation.toLowerCase()] = {};

  switch(implementation.toLowerCase()) {
    case 'sender':
      break;
    case 'consumer':
      break;
    case 'receiver': default:
// console.dir(response);
      switch(response.xhr._method.toUpperCase()) {
        case 'OPTIONS':
          checkTests = ['10'];
          break;

        case 'HEAD':
          checkTests = ['18'];
          break;

        case 'GET':
          checkTests = ['1'];
          break;

        case 'POST':
          checkTests = ['2', '3', '4', '5'];
          break;
      }

      break;
  }

  checkTests.forEach(function(test){
    r[implementation][test] = {};
    r[implementation][test]['result'] = ldnTests[implementation][test]['function'](req, response);
  })

  return r;
}

function checkGet(url, headers){
  var headers = headers || {};
  headers['Accept'] = (headers && 'Accept' in headers) ? headers['Accept'] : 'application/ld+json';

  return getResource(url, headers).then(
    function(i){ console.log('checkPost: true'); return true; },
    function(j){ console.log('checkPost: false'); return false; });
}

function checkPost(req, response){
  var c = (response.xhr.status != 405);
console.log('checkPost: ' + c);
  return c;
}

function checkPostResponseCreated(req, response){
  var c = (response.xhr.status == 201);
console.log('checkPostResponseCreated: ' + c);

  return c;
}

function checkPostResponseLocation(req, response){
  var location = response.xhr.getResponseHeader('Location');

  if(location){
    var url = location;
    if(location.toLowerCase().slice(0,7) != 'http://' || location.toLowerCase().slice(0,8) != 'https://') {
      //TODO: baseURL for response.xhr.getResponseHeader('Location') .. check response.responseURL?
      url = location;
    }

    return checkGet(url).then(
      function(i){ console.log('checkPostResponseLocation: true'); return true; },
      function(j){ console.log('checkPostResponseLocation: false'); return false; });
  }
  else {
    console.log('checkPostResponseLocation: false');
    return false;
  }
}

function checkPostResponseAccepted(req, response){
  var c = (response.xhr.status == 202) ? true : ((response.xhr.status == 201) ? 'NA' : false) ;
console.log('checkPostResponseAccepted: ' + c);

  return c;
}

function checkHead(req, response){
  var c = (response.xhr.status != 405);
console.log('checkHead: ' + c);
  return c;
}

function checkOptions(req, response){
  var c = (response.xhr.status != 405);
console.log('checkOptions: ' + c);
  return c;
}



function getTestReportHTML(report){
  var s = '';

  Object.keys(report).forEach(function(implementation){
    Object.keys(report[implementation]).forEach(function(test){
      s += '<tr id="test-' + test + '"><td class="test-id">' + test + '</td><td class="test-result">' + report[implementation][test]['result'] + '</td><td class="test-description">' + ldnTests[implementation][test]['description'] + '</td></tr>';
    });
  });

  return s;
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

  return `<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta charset="utf-8" />
        <title>Linked Data Notifications (LDN) Tests - Receiver</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="https://dokie.li/media/css/basic.css" media="all" rel="stylesheet" title="Basic" />
<style>
#test-receiver label {
width: 15%;
text-align: right;
padding: 0.25em;
}
#test-receiver-response pre { overflow: auto; }
.dn { display:none }
</style>
<script>

function updateForm(node, options){
  var data = document.querySelector('textarea[name="test-receiver-data"]');
  var mimetypeLabel = document.querySelectorAll('label[for="test-receiver-mimetype"] span');

  switch(node.value){
    case 'GET': case 'HEAD': case 'OPTIONS': default:
      data.parentNode.classList.add('dn');
      data.setAttribute('disabled', 'disabled');
      mimetypeLabel[0].classList.remove('dn');
      mimetypeLabel[2].classList.add('dn');
      break;
    case 'POST':
      data.parentNode.classList.remove('dn');
      data.removeAttribute('disabled');
      mimetypeLabel[0].classList.add('dn');
      mimetypeLabel[2].classList.remove('dn');
      break;
  }
}

function init() {
  // var selectReceiverMethod = document.querySelector('select[name="test-receiver-method"]');
  // updateForm(selectReceiverMethod);

  // selectReceiverMethod.addEventListener('change', function(e) {
  //   updateForm(e.target);
  // });
}
document.addEventListener('DOMContentLoaded', function(){ init(); });
</script>
    </head>

    <body about="" prefix="rdf: http://www.w3.org/1999/02/22-rdf-syntax-ns# rdfs: http://www.w3.org/2000/01/rdf-schema# owl: http://www.w3.org/2002/07/owl# xsd: http://www.w3.org/2001/XMLSchema# dcterms: http://purl.org/dc/terms/ dctypes: http://purl.org/dc/dcmitype/ foaf: http://xmlns.com/foaf/0.1/ v: http://www.w3.org/2006/vcard/ns# pimspace: http://www.w3.org/ns/pim/space# cc: http://creativecommons.org/ns# skos: http://www.w3.org/2004/02/skos/core# prov: http://www.w3.org/ns/prov# qb: http://purl.org/linked-data/cube# schema: https://schema.org/ rsa: http://www.w3.org/ns/auth/rsa# cert: http://www.w3.org/ns/auth/cert# cal: http://www.w3.org/2002/12/cal/ical# wgs: http://www.w3.org/2003/01/geo/wgs84_pos# org: http://www.w3.org/ns/org# biblio: http://purl.org/net/biblio# bibo: http://purl.org/ontology/bibo/ book: http://purl.org/NET/book/vocab# ov: http://open.vocab.org/terms/ sioc: http://rdfs.org/sioc/ns# doap: http://usefulinc.com/ns/doap# dbr: http://dbpedia.org/resource/ dbp: http://dbpedia.org/property/ sio: http://semanticscience.org/resource/ opmw: http://www.opmw.org/ontology/ deo: http://purl.org/spar/deo/ doco: http://purl.org/spar/doco/ cito: http://purl.org/spar/cito/ fabio: http://purl.org/spar/fabio/ oa: http://www.w3.org/ns/oa# as: http://www.w3.org/ns/activitystreams# ldp: http://www.w3.org/ns/ldp# solid: http://www.w3.org/ns/solid/terms#" typeof="schema:CreativeWork sioc:Post prov:Entity">
        <main>
            <article about="" typeof="schema:Article">
                <h1 property="schema:name">Linked Data Notifications (LDN) Tests - Receiver</h1>

                <div id="content">
                    <section id="receiver" inlist="" rel="schema:hasPart" resource="#receiver">
                        <h2 property="schema:name">Receiver</h2>
                        <div datatype="rdf:HTML" property="schema:description">
                            <form action="" id="test-receiver" method="post">
                                <fieldset>
                                    <legend>Test Receiver</legend>

                                    <ul>
                                         <li>
                                            <label for="test-receiver-url">URL</label>
                                            <input type="text" name="test-receiver-url" placeholder="https://linkedresearch.org/ldn/tests/inbox/" value="" />
                                        </li>

                                        <li>
                                            <label for="test-receiver-data">Data</label>
                                            <textarea name="test-receiver-data" cols="80" rows="10" placeholder="Enter data">{ "@id": "http://example.net/note#foo", "http://schema.org/citation": { "@id": "http://example.org/article#results" } }</textarea>
                                        </li>
                                    </ul>

                                    <input type="hidden" name="test-implementation" value="receiver" />
                                    <input type="submit" value="Submit" />
                                </fieldset>
                            </form>
${(results && 'test-receiver-response-html' in results) ? results['test-receiver-response-html'] : ''}
                        </div>
                    </section>
                </div>
            </article>
        </main>
    </body>
</html>
`;
}

//${(request && 'test-receiver-url' in request) ? request['test-receiver-url'] : ''}
//${(request && 'test-receiver-data' in request) ? request['test-receiver-data'] : ''}


module.exports = {
ldnTests
}
