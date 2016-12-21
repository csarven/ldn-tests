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
var vocab = mayktso.vocab;
var getGraphFromData = mayktso.getGraphFromData;
var SimpleRDF = mayktso.SimpleRDF;
var parseLinkHeader = mayktso.parseLinkHeader;

var ldnTests = {
  'sender': {},
  'receiver': {
    'checkOptions': {
      'description': '<em class="rfc2119">MAY</em> accept other RDF content types (e.g., <code>text/turtle</code>, <code>text/html</code>), and if so, <em class="rfc2119">SHOULD</em> advertise the content types they accept with an <code>Accept-Post</code> header in response to an <code>OPTIONS</code> request on the Inbox URL.'
    },
    'checkHead': {
      'description': 'Inbox accepts <code>HEAD</code> requests'
    },
    'checkGet': {
      'description': '<em class="rfc2119">MUST</em> support <code>GET</code> request on the Inbox URL.',
      'test': {
        'checkGetResponseSuccessful': {
          'description': 'A successful <code>GET</code> request on the Inbox <em class="rfc2119">MUST</em> return a <code>HTTP 200 OK</code> with the URIs of notifications, subject to the requester’s access (returning <code>4xx</code> error codes as applicable).',
          'test': {
            'checkGetResponseNotificationsLimited': {
              'description': 'Receivers <em class="rfc2119">MAY</em> list only URIs of notifications in the Inbox that the consumer is able to access.'
            },
            'checkGetResponseLDPContains': {
              'description': 'Each notification URI <em class="rfc2119">MUST</em> be related to the Inbox URL with the <code>http://www.w3.org/ns/ldp#contains</code> predicate.'
            },
            'extraCheckGetResponseLDPContainer': {
              'description': 'Inbox is an <code>ldp:Container</code>'
            },
            'extraCheckGetResponseLDPConstrainedBy': {
              'description': 'Any additional description about the Inbox itself <em class="rfc2119">MAY</em> also be returned (e.g., <a href="#constraints">Constraints</a>).'
            }
          }
        },
      }
    },
    'checkPost': {
      'description': '<em class="rfc2119">MUST</em> support <code>POST</code> request on the Inbox URL.',
      'test': {
        'checkPostResponseCreated': {
          'description': '<em class="rfc2119">MUST</em> respond with status code <code>201 Created</code>',
          'test': {
            'checkPostResponseLocation': {
              'description': '<code>Location</code> header set to the URL from which the notification data can be retrieved.'
            },
            'checkPostResponseJSONLDAccepted': {
              'description': '<em class="rfc2119">MUST</em> accept notifications where the request body is JSON-LD, with the <code>Content-Type: application/ld+json</code>',
              'test': {
                'checkPostResponseProfileLinkRelationAccepted': {
                  'description': '...which <em class="rfc2119">MAY</em> include a <code>profile</code> URI'
                }
              }
            }
          }
        },
        'checkPostResponseAccepted': {
          'description': 'If the request was queued to be processed asynchronously, the receiver <em class="rfc2119">MUST</em> respond with a status code of <code>202 Accepted</code> and include information about the status of the request in the body of the response.',
          'test': {
            'checkPostResponseBody': {
              'description': 'TODO: Read the body'
            },
            'checkPostResponseJSONLDAccepted': {
              'description': '<em class="rfc2119">MUST</em> accept notifications where the request body is JSON-LD, with the <code>Content-Type: application/ld+json</code>',
              'test': {
                'checkPostResponseProfileLinkRelationAccepted': {
                  'description': '...which <em class="rfc2119">MAY</em> include a <code>profile</code> URI'
                }
              }
            }
          }
        }
      }
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
      var initTest = { '1': checkOptions, '2': checkHead, '3': checkGet, '4': checkPost };

        if(req.body['test-receiver-url'] && (req.body['test-receiver-url'].toLowerCase().slice(0,7) == 'http://' || req.body['test-receiver-url'].toLowerCase().slice(0,8) == 'https://')) {
          Object.keys(initTest).forEach(function(id) {
            testReceiverPromises.push(initTest[id](req));
          });

          Promise.all(testReceiverPromises)
            .then((results) => {
//console.dir(results);
console.dir(ldnTests);

              var reportHTML = getTestReportHTML(ldnTests['receiver']);

              results['test-receiver-response-html'] = `
    <div id="test-receiver-response">
      <table id="test-receiver-report">
        <caption>Test results</caption>
        <thead><tr><th>Id</th><th>Result</th><th>Message</th><th>Description</th></tr></thead>
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
    </div>`;

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
  var headers = {};
  headers['Content-Type'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
  var url = req.body['test-receiver-url'];

  return getResourceOptions(url, headers).then(
    function(response){
      ldnTests['receiver']['checkOptions']['result'] = { 'code': 'PASS', 'message': '' };
      return Promise.resolve(ldnTests['receiver']['checkOptions']);
    },
    function(reason){
      if(reason.xhr.status == 405) {
        ldnTests['receiver']['checkOptions']['result'] = { 'code': 'FAIL', 'message': '<code>HTTP 405</code>' };
      }
      return Promise.resolve(ldnTests['receiver']['checkOptions']);
    });
}

function checkHead(req){
  var headers = {};
  headers['Content-Type'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
  var url = req.body['test-receiver-url'];

  return getResourceHead(url, headers).then(
    function(response){
      ldnTests['receiver']['checkHead']['result'] = { 'code': 'PASS', 'message': '' };
      return Promise.resolve(ldnTests['receiver']['checkHead']);
    },
    function(reason){
      if(reason.xhr.status == 405) {
        ldnTests['receiver']['checkHead']['result'] = { 'code': 'FAIL', 'message': '<code>HTTP 405</code>' };
      }
      return Promise.resolve(ldnTests['receiver']['checkHead']);
    });
}

function checkGet(req){
  var headers = {};
  headers['Accept'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
  var url = req.body['test-receiver-url'];

  return getResource(url, headers).then(
    function(response){
      ldnTests['receiver']['checkGet']['result'] = { 'code': 'PASS', 'message': '' };
      ldnTests['receiver']['checkGet']['test']['checkGetResponseSuccessful']['result'] = { 'code': 'PASS', 'message': '' };
      ldnTests['receiver']['checkGet']['test']['checkGetResponseSuccessful']['test']['checkGetResponseNotificationsLimited']['result'] = { 'code': 'NA', 'message': 'Check manually.' };

      var data = response.xhr.responseText;
      var contentType = response.xhr.getResponseHeader('Content-Type');
      if(typeof contentType !== undefined) {
        if(contentType.indexOf(headers['Accept'] + ';') == 0) {
          var options = {
            'contentType': headers['Accept'],
            'subjectURI': url
          }
          return getGraphFromData(data, options).then(
            function(g) {
              var s = SimpleRDF(vocab, options['subjectURI'], g, RDFstore).child(options['subjectURI']);

              var notifications = [];
              s.ldpcontains.forEach(function(resource) {
                  notifications.push(resource.toString);
              });

              if(notifications.length > 0) {
                ldnTests['receiver']['checkGet']['test']['checkGetResponseSuccessful']['test']['checkGetResponseLDPContains']['result'] = { 'code': 'PASS', 'message': 'Found ' + notifications.length + ' notifications.' };

                // var notificationsAsRDFSource = [];
                // var headers = {};
                // headers['Accept'] = 'application/ld+json';
                // notifications.forEach(function(url){
                //   getResource(url, headers).then(
                //     function(response){
                //       var data = response.xhr.responseText;
                //       var contentType = response.xhr.getResponseHeader('Content-Type');
                //     }
                //   });
                // ldnTests['receiver']['checkGet']['test']['checkGetResponseLDPContains']['result'] = { 'code': 'PASS', 'message': 'Found ' + notifications.length + ' notifications'. };
                // });
              }
              else {
                ldnTests['receiver']['checkGet']['test']['checkGetResponseSuccessful']['test']['checkGetResponseLDPContains']['result'] = { 'code': 'NA', 'message': 'Did not find <code>ldp:contains</code>.' };
              }

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

                ldnTests['receiver']['checkGet']['test']['checkGetResponseSuccessful']['test']['extraCheckGetResponseLDPContainer']['result'] = { 'code': 'NA', 'message': 'Found in <code>Link</code> header: ' + rdftypes.join(', ') };
              }
              else if(resourceTypes.indexOf(vocab.ldpcontainer["@id"]) > -1 || resourceTypes.indexOf(vocab.ldpbasiccontainer["@id"]) > -1) {
                resourceTypes.forEach(function(url){
                  if(url == vocab.ldpcontainer["@id"] || url == vocab.ldpbasiccontainer["@id"]) {
                    rdftypes.push('<a href="' + url + '">' + url + '</a>');
                  }
                });

                ldnTests['receiver']['checkGet']['test']['checkGetResponseSuccessful']['test']['extraCheckGetResponseLDPContainer']['result'] = { 'code': 'NA', 'message': 'Found in body: ' + rdftypes.join(', ') };
              }
              else {
                ldnTests['receiver']['checkGet']['test']['checkGetResponseSuccessful']['test']['extraCheckGetResponseLDPContainer']['result'] = { 'code': 'NA', 'message': 'Not found.' };
              }

              if (vocab['ldpconstrainedBy']['@id'] in linkHeaders && linkHeaders[vocab['ldpconstrainedBy']['@id']].length > 0) {
                var constrainedBys = [];
                linkHeaders[vocab['ldpconstrainedBy']['@id']].forEach(function(url){
                  constrainedBys.push('<a href="' + url + '">' + url + '</a>');
                });

                ldnTests['receiver']['checkGet']['test']['checkGetResponseSuccessful']['test']['extraCheckGetResponseLDPConstrainedBy']['result'] = { 'code': 'NA', 'message': 'Found: ' + constrainedBys.join(', ') };
              }
              else {
                ldnTests['receiver']['checkGet']['test']['checkGetResponseSuccessful']['test']['extraCheckGetResponseLDPConstrainedBy']['result'] = { 'code': 'NA', 'message': 'Not found.' };
              }

              return Promise.resolve(ldnTests['receiver']['checkGet']);
            },
            function(reason){
              ldnTests['receiver']['checkGet']['result'] = { 'code': 'FAIL', 'message': 'Inbox can not be parsed as ' + headers['Accept'] };
              return Promise.resolve(ldnTests['receiver']['checkGet']);
            });      
        }
      }
    },
    function(reason){
      var code = 'FAIL';
      if(typeof reason.xhr.status !== 'undefined' && reason.xhr.status >= 400 && reason.xhr.status < 500) { //HTTP 4xx
        code = 'PASS';
      }

      ldnTests['receiver']['checkGet']['test']['checkGetResponseSuccessful']['result'] = { 'code': code, 'message': '<code>HTTP '+ reason.xhr.status + '</code>, <code>Content-Type: ' + reason.xhr.getResponseHeader('Content-Type') + '</code>' };
      return Promise.resolve(ldnTests['receiver']['checkGet']);
    });
}



function checkPost(req){
  var headers = {}, data;

  headers['Content-Type'] = ('test-receiver-mimetype' in req.body) ? req.body['test-receiver-mimetype'] : 'application/ld+json';
  data = ('test-receiver-data' in req.body && req.body['test-receiver-data'].length > 0) ? req.body['test-receiver-data'] : '';

  return postResource(req.body['test-receiver-url'], '', data, headers['Content-Type']).then(
    function(response){
      ldnTests['receiver']['checkPost']['result'] = { 'code': 'PASS', 'message': '' };

      //checkPostResponseCreated
      if(response.xhr.status == 201) {
        ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['result'] = { 'code': 'PASS', 'message': '' };
        ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['test']['checkPostResponseJSONLDAccepted']['result'] = { 'code': 'PASS', 'message': '' };
        ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['test']['checkPostResponseJSONLDAccepted']['test']['checkPostResponseProfileLinkRelationAccepted']['result'] = { 'code': 'NA', 'message': 'If the request <code>Content-Type</code> included a URI for <code>profile</code>, this is a PASS.' };

        var location = response.xhr.getResponseHeader('Location');
        if(location){
          var url = location;
          if(location.toLowerCase().slice(0,7) != 'http://' || location.toLowerCase().slice(0,8) != 'https://') {
            //TODO: baseURL for response.xhr.getResponseHeader('Location') .. check response.responseURL?
            url = location;
          }

          var headers = {};
          headers['Accept'] = 'application/ld+json';
// console.log('=======');
// console.log(url);
// console.log('=======');
          //checkPostResponseLocation
          return getResource(url, headers).then(
            //Maybe use checkPostResponseLocationRetrieveable
            function(i){
// console.log(i);
              ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['test']['checkPostResponseLocation']['result'] = { 'code': 'PASS', 'message': '<code>Location</code>: <a href="' + url + '">' + url + '</a> found and can be retrieved.' };
// console.log(ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['test']['checkPostResponseLocation']['result']);
              return Promise.resolve(ldnTests['receiver']['checkPost']);
            },
            function(j){
// console.log(j);
              ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['test']['checkPostResponseLocation']['result'] = { 'code': 'FAIL', 'message': '<code>Location</code>: <a href="' + url + '">' + url + '</a> found but can not be retrieved: <code>HTTP ' + j.xhr.status + '</code>' };
// console.log(ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['test']['checkPostResponseLocation']['result']);
              return Promise.resolve(ldnTests['receiver']['checkPost']);
            });
        }
        else {
          ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['test']['checkPostResponseLocation']['result'] = { 'code': 'FAIL', 'message': '<code>Location</code> header not found.' };
          return Promise.resolve(ldnTests['receiver']['checkPost']);
        }
      }
      //checkPostResponseAccepted
      else if(response.xhr.status == 202) {
        ldnTests['receiver']['checkPost']['test']['checkPostResponseAccepted']['result'] = { 'code': 'PASS', 'message': '' };
        ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['test']['checkPostResponseJSONLDAccepted']['result'] = { 'code': 'PASS', 'message': '' };
        ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['test']['checkPostResponseJSONLDAccepted']['test']['checkPostResponseProfileLinkRelationAccepted']['result'] = { 'code': 'NA', 'message': 'If the request <code>Content-Type</code> included a URI for <code>profile</code>, this is a PASS.' };
        return Promise.resolve(ldnTests['receiver']['checkPost']);
      }
    },
    function(reason){
console.log(reason);
      switch(reason.xhr.status){
        case '400':
          ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['test']['checkPostResponseConstraintsUnmet']['result'] = { 'code': 'PASS', 'message': 'constraints on the notifications <em class="rfc2119">SHOULD</em> fail to process the notification if the constraints are not met and return the appropriate <code>4xx</code> error code.' };
          ldnTests['receiver']['checkPost']['test']['checkPostResponseCreated']['test']['checkPostResponseJSONLDAccepted']['result'] = { 'code': 'FAIL', 'message': '<em class="rfc2119">MUST</em> accept notifications where the request body is JSON-LD, with the <code>Content-Type: application/ld+json</code>' };
          break;
        case '405':
          ldnTests['receiver']['checkPost']['result'] = { 'code': 'FAIL', 'message': '<em class="rfc2119">MUST</em> support <code>POST</code> request on the Inbox URL.' };
          break;
        default:
          if(response.xhr.status >= 500 && response.xhr.status < 600) {
            ldnTests['receiver']['checkPost']['result'] = { 'code': 'FAIL', 'message': '<code>HTTP ' + reason.xhr.status + '</code>' };
          }
          break;
      }

      return Promise.resolve(ldnTests['receiver']['checkPost']);
    });
}



function getTestReportHTML(test){
  var s = [];

  Object.keys(test).forEach(function(id){
    if('result' in test[id]) {
      var testResult = '';

      switch(test[id]['result']['code']){
        default: testResult = test[id]['result']['code']; break;
        case 'PASS': testResult = '✔'; break;
        case 'FAIL': testResult = '✗'; break;
        case 'NA': testResult = '-'; break;
      }

      s.push('<tr id="test-' + id + '"><td class="test-id">' + id + '</td><td class="test-result test-' + test[id]['result']['code'] + '">' + testResult + '</td><td class="test-message">' + test[id]['result']['message'] + '</td><td class="test-description">' + test[id]['description'] + '</td></tr>');
    }

    if('test' in test[id]) {
      s.push(getTestReportHTML(test[id]['test']));
    }
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

.test-result { text-align: center; }
.test-PASS { background-color: #0f0; }
.test-FAIL { background-color: #f00; }
.test-NA { background-color: #eee; }
tfoot dd:after { content: "\\A"; white-space:pre; }
tfoot dt, tfoot dd { display:inline; }
.rfc2119 {
text-transform:lowercase;
font-variant:small-caps;
font-style:normal;
}
em.rfc2119 { color: #900; }
code { color: #c83500; }
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
