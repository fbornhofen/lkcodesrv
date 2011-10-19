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
    /*var buffer = new Buffer(body.length, 'binary');
    buffer.write(body);
    logger.info('Proxy response length/bytes = ' + buffer.length);
    logger.info('Proxy resp = ' + 
      buffer[0].toString(16) + ' ' + 
      buffer[1].toString(16) + ' ' + 
      buffer[2].toString(16) + ' ' + 
      buffer[3].toString(16) + ' ' + 
      buffer[4].toString(16) + ' ' + 
      buffer[5].toString(16) + ' ' + 
      buffer[6].toString(16) + ' ...');*/
    function copyHeader(name, from, to) {
      to.header(name, from.header(name));
    }
    copyHeader('Content-type', resp, clientResp);
    copyHeader('Content-length', resp, clientResp);
    //clientResp.send(buffer.toString());
    clientResp.send(body);
  };

  var collectBody = function(req, next) {
    var buffer = new Buffer(parseInt(req.header('Content-length')), 'binary');
    var offset = 0;
    req.on('data', function(chunk) {
      chunk.copy(buffer, offset);
      offset += chunk.length });
    req.on('end', function() { 
      next(buffer); });
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

