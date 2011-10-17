var mime = require('mime');
var libxml = require('libxmljs');

module.exports = function(codeDatabase, logger) {

  var codedb = codeDatabase;
  var logger = logger;

  var Controller = {};

  var getCodeDb = Controller.getCodeDb = function() {
    return codedb;
  }
                                                    
  var sendFileFromDbRow = Controller.sendFileFromDbRow = function(dbres, res) {
    if (!dbres.isEmpty) {
      res.header('Content-Type', mime.lookup(dbres['path']));
      res.send(dbres['contents']);
    } else {
      res.send('');
      return;
    }
  }
  
  var evalJs = Controller.evalJs = function(aString, response, onError) {
    try {
      var func = eval('(' + aString + ')');
      func(response);
    } catch (e) {
      return onError(JSON.stringify(e));
    }
  }
                        
  var handlePostAndPut = Controller.handlePostAndPut = function(req, res) {
    var path = req.params[0];
    var data = '';
    var putLatestFile = function(path, user, data, next) {
      codedb.getLatestRevisionNumber(function(revNr) {
        codedb.putFile(path, revNr + 1, user, data, next);
      });
    };
    var writeData = function() {
      // TODO users 
      putLatestFile(path, 0, data, function() {res.send('');});
    };
    if (req.body) {
      data = req.body;
      writeData();
      return;
    }
    req.on('data', function(chunk) { data += chunk; });
    req.on('end', writeData);
  };
                      
  var propFindPath = Controller.propfindPath = function(req, res) {
    res.header('Content-Type', 'application/xml'); 
    var path = req.params[0],
        absPath = '/' + path;
    logger.info('PROPFIND ' + path);
    var doc = new libxml.Document(function(d) {
        d.node('D:multistatus', {"xmlns:D": "DAV:"}, function(n) {
          codedb.getLatestRevisionNumber(function(revNr) {
            /* n.node('D:response', {'xmlns:lp1': 'DAV'}, function(n) {
              n.node('D:href', absPath);
              n.node('D:propstat', function(n) {
                n.node('D:prop', function(n) {
                  n.node('D:displayname', absPath);
                  n.node('D:getcontentlength', 0);                       // stub
                  n.node('D:executable');
                  n.node('D:checked-in');
                  n.node('D:checked-out');
                  n.node('lp1:creationdate', '2011-10-04T23:05:34Z');    // stub
                  n.node('lp1:getlastmodified', '2011-10-04T23:05:34Z'); // stub
                  n.node('lp1:getetag', '\"1044c3-1dc-4ae8f5ea0de80\"'); // stub
                  n.node('D:getcontenttype', 'httpd/unix-directory'); // stub
                  n.node('lp1:resourcetype', function(n) {
                    n.node('lp1:collection');
                  });
                  res.send(doc.toString(), 207);
                });
              });
            }); */
            codedb.listFilesInPath(path, revNr, function(files) {
              var filesProcessed = 0;
              if (files.length == 0) { res.send(doc.toString(), 404); return; };
              files.forEach(function (file) {
                n.node('D:response', {'xmlns:lp1': 'DAV:'}, function (respNode) {
                  //n.node('D:href', 'http://' + req.header('Host') + path +  file);
                  respNode.node('D:propstat', function(n) {
                    n.node('D:status', 'HTTP/1.1 200 OK');
                    n.node('D:prop', function(n) {
                      n.node('D:displayname', absPath + file);
                      n.node('D:getcontentlength', 0);                       // stub
                      n.node('D:executable');
                      n.node('D:checked-in');
                      n.node('D:checked-out');
                      n.node('lp1:creationdate', '2011-10-04T23:05:34Z');    // stub
                      n.node('lp1:getlastmodified', '2011-10-04T23:05:34Z'); // stub
                      n.node('lp1:getetag', '\"1044c3-1dc-4ae8f5ea0de80\"'); // stub
                      codedb.isDirectory(path + file, revNr, function(aBoolean) {
                        if (aBoolean) {
                          n.node('D:getcontenttype', 'httpd/unix-directory');
                          n.node('lp1:resourcetype', function(n) {
                            n.node('lp1:collection');
                          });
                        } else {
                          n.node('D:getcontenttype', mime.lookup(file));
                        }
                        // this is how lively decides whether a path is a directory...
                        respNode.node('D:href', absPath + file + (aBoolean?'/':''));
                        if (++filesProcessed == files.length) {
                          logger.trace('doc: ' + doc.toString());
                          res.send(doc.toString(), 207);
                          return;
                        }
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
  };

  var handleOptions = Controller.handleOptions = function(req, res) {
    logger.info('OPTIONS');
    res.header('MS-Author-Via', 'DAV');
    res.header('Vary: Accept-Encoding');
    res.header('DAV',  '1,2');
    res.header('DAV', '<http://apache.org/dav/propset/fs/1>');
    res.header('Content-Type', 'httpd/unix-directory');
    res.header('Allow', 'OPTIONS,GET,HEAD,POST,DELETE,TRACE,PROPFIND,PROPPATCH,COPY,MOVE,LOCK,UNLOCK');
    res.send('');
  }

  return Controller;  

}                                                                                  
