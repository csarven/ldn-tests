var fs = require('fs');
var etag = require('etag');
//var bodyParser = require('body-parser');
var mayktso = require('mayktso');

mayktso.init();

mayktso.app.route('/receiver').all(testResource);
//console.log(mayktso.app._router.stack);
var getResource = mayktso.getResource;
var postResource = mayktso.postResource;
var htmlEntities = mayktso.htmlEntities;

function testResource(req, res, next){
// console.log(req.requestedPath);
  switch(req.method){
    case 'GET':
      if(!req.accepts(['text/html', '*/*'])) {
        res.status(406);
        res.end();
        return next();
      }
//      fs.stat(req.requestedPath, function(error, stats) {
        // if (error) {
        //   res.status(404);
        //   return next();
        // }

        // if (error) { console.log(error); }

        var data = getTestReceiverHTML();

        if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
          res.status(304);
          res.end();
        }

        res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
        res.set('Content-Type', 'text/html;charset=utf-8');
        res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
        res.set('ETag', etag(data));
//          res.set('Last-Modified', stats.mtime);
        res.set('Vary', 'Origin');
        res.set('Allow', 'GET, POST');
        res.status(200);
        res.send(data);
        return next();
//      });

      break;

    case 'POST':
// console.log(req);
      var values = req.body || {};
console.log(values);

      if(values['test-receiver-method'] && values['test-receiver-url'] && (values['test-receiver-url'].toLowerCase().slice(0,7) == 'http://' || values['test-receiver-url'].toLowerCase().slice(0,8) == 'https://')) {
// console.log(values['test-receiver-url']);
        var headers = {};
        var data;
        switch(values['test-receiver-method']){
          case 'GET': case 'HEAD': case 'OPTIONS': default:
            headers['Accept'] = ('test-receiver-mimetype' in values) ? values['test-receiver-mimetype'] : 'application/ld+json';
// console.log(headers);
            getResource(values['test-receiver-url'], headers)
              .then(function(response){
// console.log(response);
                var options = {};
                options['test-receiver-response'] = getTestReceiverResponseHTML(response, headers);

                data = getTestReceiverHTML(options);
                res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
                res.set('Content-Type', 'text/html;charset=utf-8');
                res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
                res.set('ETag', etag(data));
//                    res.set('Last-Modified', stats.mtime);
                res.set('Vary', 'Origin');
                res.set('Allow', 'GET, POST');
                res.status(200);
                res.send(data);
                return next();
              })
              .catch(function(reason){
                console.log('Error:');
                console.log(reason);
              });

            break;

          case 'POST':
            headers['Content-Type'] = ('test-receiver-mimetype' in values) ? values['test-receiver-mimetype'] : 'application/ld+json';

            data = ('test-receiver-data' in values && values['test-receiver-data'].length > 0) ? values['test-receiver-data'] : '';

            postResource(values['test-receiver-url'], '', data, headers['Content-Type'])
              .then(function(response){
// console.log(response.xhr);

                var options = {};
                options['test-receiver-response'] = getTestReceiverResponseHTML(response, headers);


                data = getTestReceiverHTML(options);
                res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
                res.set('Content-Type', contentType +';charset=utf-8');
                res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
                res.set('ETag', etag(data));
//                    res.set('Last-Modified', stats.mtime);
                res.set('Vary', 'Origin');
                res.set('Allow', 'GET, POST');
                sendHeaders(data, 'text/html');
                res.status(200);
                res.send(data);
                return next();
              })
              .catch(function(reason){
                console.log('Not Found:');
                console.dir(reason);
              });

            break;
        }
      }
      else {
        resetPOST();
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

function resetPOST(){
  //TODO Reset POST
  res.end();
  return next();
}


function getTestReceiverResponseHTML(response, headers){
    return `<div id="test-receiver-response">
    <p>Response headers:</p>
    <pre id="test-receiver-response-header">${htmlEntities(response.xhr.getAllResponseHeaders())}</pre>

    <p>Response body:</p>
    <pre id="test-receiver-response-data">${htmlEntities(response.xhr.responseText)}</pre>

    <p>Report (TODO: Add ✔ or ✗ for each applicable test. Hide N/A tests):</p>
    <div id="test-receiver-response-report">
        <ul>
            <li>[ ] <em class="rfc2119">MUST</em> support <code>GET</code> and <code>POST</code> requests on the Inbox URL.</li>
            <li>[ ] <em class="rfc2119">MUST</em> respond with status code <code>201 Created</code> and the <code>Location</code> header set to the URL from which the notification data can be retrieved.</li>
            <li>[ ] If the request was queued to be processed asynchronously, the receiver <em class="rfc2119">MUST</em> respond with a status code of <code>202 Accepted</code> and include information about the status of the request in the body of the response.</li>
            <li>[ ] constraints on the notifications <em class="rfc2119">SHOULD</em> fail to process the notification if the constraints are not met and return the appropriate <code>4xx</code> error code.</li>
            <li>[ ] <em class="rfc2119">MUST</em> accept notifications where the request body is JSON-LD, with the <code>Content-Type: application/ld+json</code></li>
            <li>...which <em class="rfc2119">MAY</em> include a <code>profile</code> URI</li>
            <li>[ ] <em class="rfc2119">MAY</em> accept other RDF content types (e.g., <code>text/turtle</code>, <code>text/html</code>), and if so, <em class="rfc2119">SHOULD</em> advertise the content types they accept with an <code>Accept-Post</code> header in response to an <code>OPTIONS</code> request on the Inbox URL.</li>
            <li>[ ] A successful <code>GET</code> request on the Inbox <em class="rfc2119">MUST</em> return a <code>HTTP 200 OK</code> with the URIs of notifications, subject to the requester’s access (returning <code>4xx</code> error codes as applicable). Receivers <em class="rfc2119">MAY</em> list only URIs of notifications in the Inbox that the consumer is able to access.</li>
            <li>[ ] Each notification URI <em class="rfc2119">MUST</em> be related to the Inbox URL with the <code>http://www.w3.org/ns/ldp#contains</code> predicate. Each notification <em class="rfc2119">MUST</em> be an <a href="http://www.w3.org/TR/rdf11-concepts/#dfn-rdf-source">RDF source</a>. If non-RDF resources are returned, the consumer <em class="rfc2119">MAY</em> ignore them.</li>
            <li>[ ] The JSON-LD content type <em class="rfc2119">MUST</em> be available for all resources, but clients may send <code>Accept</code> headers preferring other content types (<a href="#bib-rdfc7231">RFC7231</a> Section 3.4 - Content Negotiation). If the client sends no <code>Accept</code> header, the server may send the data in JSON-LD or any format which faithfully conveys the same information (e.g., Turtle).</li>
            <li>[ ] Any additional description about the Inbox itself <em class="rfc2119">MAY</em> also be returned (e.g., <a href="#constraints">Constraints</a>).</li>

            <li>[ ] Response in ${response.xhr.getResponseHeader('Content-Type')} is (in)valid</li>
            <li>[ ] Inbox is an <code>ldp:Container</code></li>
            <li>[ ] Found <code>ldp:contains</code></li>
            <li>[ ] <code>ldp:contains</code> points to n notifications</li>
        </ul>
    </div>
</div>
`;
//            <li>[ ] <code>Accept: ${headers['Accept']}</code>, <code>Content-Type: ${response.xhr.getResponseHeader('Content-Type')}</code></li>
}



function getTestReceiverHTML(options){
    return `<!DOCTYPE html>
<html lang="en" xml:lang="en" xmlns="http://www.w3.org/1999/xhtml">
    <head>
        <meta charset="utf-8" />
        <title>Linked Data Notifications (LDN) Tests - Receiver</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="https://dokie.li/media/css/basic.css" media="all" rel="stylesheet" title="Basic" />
        <link href="https://dokie.li/media/css/lncs.css" media="all" rel="stylesheet alternate" title="LNCS" />
        <link href="https://dokie.li/media/css/acm.css" media="all" rel="stylesheet alternate" title="ACM" />
        <link href="https://www.w3.org/StyleSheets/TR/2016/W3C-ED" media="all" rel="stylesheet alternate" title="W3C-ED" />
        <link href="https://dokie.li/media/css/do.css" media="all" rel="stylesheet" />
        <link href="https://maxcdn.bootstrapcdn.com/font-awesome/4.6.3/css/font-awesome.min.css" media="all" rel="stylesheet" />
        <link href="https://dokie.li/media/css/editor.css" media="all" rel="stylesheet" />
        <script src="https://dokie.li/scripts/simplerdf.js"></script>
        <script src="https://dokie.li/scripts/medium-editor.min.js"></script>
        <script src="https://dokie.li/scripts/medium-editor-tables.min.js"></script>
        <script src="https://dokie.li/scripts/do.js"></script>
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
  var selectReceiverMethod = document.querySelector('select[name="test-receiver-method"]');
  updateForm(selectReceiverMethod);

  selectReceiverMethod.addEventListener('change', function(e) {
    updateForm(e.target);
  });
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
                            <form action="#test-receiver" id="test-receiver" method="post">
                                <fieldset>
                                    <legend>Test Receiver</legend>

                                    <ul>
                                        <li>
                                            <label for="test-receiver-url-type">Test</label>
                                            <select name="test-receiver-url-type">
                                                <option value="inbox">Inbox</option>
                                                <option value="notification">Notification</option>
                                            </select>
                                        </li>
                                        <li>
                                            <label for="test-receiver-method">Method</label>
                                            <select name="test-receiver-method">
                                                <option value="GET">GET</option>
                                                <option value="HEAD">HEAD</option>
                                                <option value="OPTIONS">OPTIONS</option>
                                                <option value="POST">POST</option>
                                            </select>
                                        </li>
                                        <li>
                                            <label for="test-receiver-url">URL</label>
                                            <input type="text" name="test-receiver-url" placeholder="https://linkedresearch.org/ldn/inbox/" />
                                        </li>
                                        <li>
                                            <label for="test-receiver-mimetype"><span>Accept</span><span class="dn"> / </span><span>Content-Type</span></label>
                                            <select name="test-receiver-mimetype">
                                                <option value="application/ld+json">application/ld+json</option>
                                                <option value="text/turtle">text/turtle</option>
                                            </select>
                                        </li>
                                        <li>
                                            <label for="test-receiver-data">Data</label>
                                            <textarea name="test-receiver-data" cols="80" rows="10" placeholder="Enter data"></textarea>
                                        </li>
                                    </ul>

                                    <input type="submit" name="test-receiver-submit" value="Submit" id="test-receiver-submit" class="submit"/>
                                </fieldset>
                            </form>
${(options && 'test-receiver-response' in options) ? options['test-receiver-response'] : ''}
                        </div>
                    </section>
                </div>
            </article>
        </main>
    </body>
</html>
`;
}
