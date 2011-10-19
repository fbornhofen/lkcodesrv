var request = require('request');

module.exports = function(logger) {

  var Proxy = {};

  // private -- helpers

  var createRequest = function(method, uri, body) {
    var reqObj = {
      method: method,
      uri: 'http://' + uri
    };
    if (body) { 
      reqObj['body'] = body;
    }
    return reqObj;
  };

  var forwardResponse = function(clientResp, err, resp, body) {
    function copyHeader(name, from, to) {
      to.header(name, from.header(name));
    }
    copyHeader('Content-type', resp, clientResp);
    copyHeader('Content-length', resp, clientResp);
    clientResp.send(body);
  };

  var collectBody = function(req, next) {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() { next(body); });
  };  

  // public

  var get = Proxy.get = function(url, req, res) {
    request(createRequest('GET', url, null), 
      function(err, resp, body) {
        forwardResponse(res, err, resp, body);
      });
  };

  var post = Proxy.post = function(url, req, res) {
    collectBody(req, function(completeBody) {
      req.body = completeBody;
      request(createRequest('POST', url, req.body),
        function(err, resp, body) {
          forwardResponse(res, err, resp, body);
        });
    });
  };

  var put = Proxy.put = function(url, req, res) {
    collectBody(req, function(completeBody) {
      req.body = completeBody;
      request(createRequest('PUT', url, req.body),
        function(err, resp, body) {
          forwardResponse(res, err, resp, body);
        });
    });
  };

  return Proxy;
}

