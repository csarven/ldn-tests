var fs = require('fs');
var etag = require('etag');
var mayktso = require('mayktso');

mayktso.init();

mayktso.app.route('/test-receiver').all(testResource);
//console.log(mayktso.app._router.stack);
var getResource = mayktso.getResource;

function testResource(req, res, next){
console.log(req.requestedPath);
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

        var sendHeaders = function(outputData, contentType) {
          res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
          res.set('Content-Type', contentType +';charset=utf-8');
          res.set('Content-Length', Buffer.byteLength(outputData, 'utf-8'));
          res.set('ETag', etag(outputData));
//          res.set('Last-Modified', stats.mtime);
          res.set('Vary', 'Origin');
          res.set('Allow', 'GET, POST');
        }
        sendHeaders(data, 'text/html');
        res.status(200);
        res.send(data);
        return next();
//      });

      break;

    case 'POST':
//      console.log(req);

      var data = req.rawBody;

      //FIXME: I don't know the available functions right now.. train
      var keyValues = {};
      var paramValues = data.split('&');
      paramValues.forEach(function(pV){
        kV = pV.split('=');
        if(kV.length == 2) {
          keyValues[kV[0]] = kV[1];
        }
      })

      console.log(keyValues);

      if(keyValues['test-receiver-method'] && keyValues['test-receiver-url']) {
        switch(keyValues['test-receiver-method']){
          case 'GET': case 'HEAD': case 'OPTIONS': default:
            var url = decodeURIComponent(keyValues['test-receiver-url']);
            if(url.toLowerCase().slice(0,7) == 'http://' || url.toLowerCase().slice(0,8) == 'https://') {
              console.log(url);

              var headers = {};
              headers['Accept'] = ('test-receiver-accept' in keyValues) ? (decodeURIComponent(keyValues['test-receiver-accept'])) : 'application/ld+json';

//console.log(headers);
              getResource(url, headers)
                .then(function(response){
// console.log(response);
                  //include test-receiver and embed data in 
                  var options = {};
                  options['test-receiver-response'] = `<div id="test-receiver-response">
		<p>Response headers:</p>
		<pre id="test-receiver-response-header">${response.xhr.getAllResponseHeaders()}</pre>

		<p>Response body:</p>
		<pre id="test-receiver-response-data">${response.xhr.responseText}</pre>

		<p>Report:</p>
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

            <li>[ ] <code>Accept: ${headers['Accept']}</code>, <code>Content-Type: ${response.xhr.getResponseHeader('Content-Type')}</code></li>
            <li>[ ] Response in ${response.xhr.getResponseHeader('Content-Type')} is (in)valid</li>
            <li>[ ] Inbox is an <code>ldp:Container</code></li>
            <li>[ ] Found <code>ldp:contains</code></li>
            <li>[ ] <code>ldp:contains</code> points to n notifications</li>
        </ul>
    </div>
</div>
<style>#test-receiver-response { overflow: auto; }</style>
`;


                  var sendHeaders = function(outputData, contentType) {
                    res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
                    res.set('Content-Type', contentType +';charset=utf-8');
                    res.set('Content-Length', Buffer.byteLength(outputData, 'utf-8'));
                    res.set('ETag', etag(outputData));
//                    res.set('Last-Modified', stats.mtime);
                    res.set('Vary', 'Origin');
                    res.set('Allow', 'GET, POST');
                  }
                  var data = getTestReceiverHTML(options);
                  sendHeaders(data, 'text/html');
                  res.status(200);
                  res.send(data);
                  return next();
                })
                .catch(function(reason){
                  console.log('Error:');
                  console.log(reason);
                });
            }
            else {
              resetPOST();
            }

            break;

          case 'POST':
            break;
        }
      }
      else {
        restPOST();
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
                                            <label for="test-receiver-accept">Accept</label>
                                            <select name="test-receiver-accept">
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



// mayktso.discoverInbox('http://linkedresearch.org/ldn/tests/');
// mayktso.getResourceHead('http://linkedresearch.org/ldn/tests/');
// mayktso.getResourceOptions('http://linkedresearch.org/ldn/tests/');

// var headers = {
// 	'Accept': 'text/turtle'
// };
// mayktso.getResourceHandler('http://linkedresearch.org/ldn/tests/inbox/', headers).then(
// 	function(i){
// 		console.log(i.toString());
// 	}
// );

// var options = {
// 	'contentType': 'application/ld+json',
// 	'subjectURI': 'http://linkedresearch.org/ldn/tests/inbox/'
// };
// mayktso.getInboxNotifications('http://linkedresearch.org/ldn/tests/inbox/', options).then(
// 	function(i){
// 		console.log(i.toString());
// 	}
// );


// var headers = {
// 	'Accept': 'text/turtle'
// };
// mayktso.getResourceHandler('http://linkedresearch.org/ldn/tests/inbox/4517ba50-a803-11e6-ac41-9b664cfffcd3', headers).then(
// 	function(i){
// 		console.log(i.toString());
// 	}
// );
