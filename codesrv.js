var express = require('express');
var sqlite3 = require('sqlite3');
var mime = require('mime');
var libxml = require('libxmljs');
var dbPath = process.argv[2];
var port = 80;

console.log('using database ' + dbPath);
var db = new sqlite3.Database(dbPath);

var app = express.createServer();

var Controller = {};
// logic

var getDatabase = Controller.getDatabase = function() {
  return db;
}

var setupDb = Controller.setupDb = function() {
  db.exec("DROP TABLE IF EXISTS files; CREATE TABLE files " +
          "(path string, revision int, timestamp int, user int, contents blob)");
}

var getFile = Controller.getFile = function(fileName, revNr, next) {
  var continueWithEmptyResult = function(next) {
    next([{contents: '', path: fileName, revision: revNr}]);
  }
  db.serialize(function() {
    db.all("SELECT * FROM files WHERE path LIKE '" + fileName + "' AND revision = " +
        "(SELECT MAX(revision) FROM files WHERE path LIKE '" + fileName + "' AND revision <= " + 
        revNr + ")", 
      function (err, dbres) {
        if (err) {
          console.log("ERROR: getFile: " + err);
          continueWithEmptyResult(next);
        }
        if (!dbres[0]) {
          console.log('WARNING: getFile ' + fileName + ' did not return any results');
          continueWithEmptyResult(next);
        } else {
          console.log('getFile ' + fileName + ', revision ' + dbres[0]['revision']);
          next(dbres);
        }
      });
  });
}

var putFile = Controller.putFile = function(fileName, revNr, user, contents, next) {
  db.serialize(function() {
    var currentTime = new Date().getTime();
    // TODO hackhackhack clean this up
    var stmt = db.prepare("INSERT INTO files (path, revision, timestamp, user, contents) VALUES ('" + 
      fileName + "', " + revNr + ", " + currentTime + ", " + user + ", (?))");
    stmt.run(contents); 
    stmt.finalize(next);
  });
}

var getLatestRevisionNumber = Controller.getLatestRevisionNumber = function(next) {
  db.serialize(function() {
    db.all("SELECT MAX(revision) FROM files", function(err, dbres) {
      next(dbres[0]["MAX(revision)"]);
    });
  });
}

var listFilesInPath = Controller.listFilesInPath = function(path, revNr, next) {
  db.serialize(function() {
    db.all("SELECT path FROM files WHERE path LIKE '" + path + "%' AND revision <= " + revNr, function(err, dbres) {
      var children = {};
      if (err) {
        console.log(err);
        next([]);
        return;
      }
      dbres.forEach(function(ea) {
        var curPath = ea['path'].substring(path.length + (path[path.length-1]=='/'?0:1)), 
            firstLevelNode = curPath.split('/')[0];
        children[firstLevelNode] = firstLevelNode;
      });
      var result = [];
      for (var prop in children) { result.push(children[prop]); }
      next(result);
    });
  });
}

var isDirectory = Controller.isDirectory = function(path, revNr, next) {
  db.serialize(function() {
    db.all("SELECT path FROM files WHERE path LIKE '" + path + "/%' AND revision <= " + revNr, function(err, dbres) {
      if (err) {
        console.log(err);
        return;
      }
      next(dbres.length > 0); // a path p is a directory if there are files in the db that are prefixed by p
    });
  });
}

// controller

var sendFileFromDbRow = Controller.sendFileFromDbRow = function(dbres, res) {
  if (dbres[0]) {
    res.header('Content-Type', mime.lookup(dbres[0].path));
    res.send(dbres[0]['contents']);
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
    getLatestRevisionNumber(function(revNr) {
      putFile(path, revNr + 1, user, data, next);
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

// TODO new method
var propFindPath = Controller.propfindPath = function(req, res) {
  res.header('Content-Type', 'application/xml');
  var path = req.params[0],
      absPath = '/' + path;
  console.log('PROPFIND ' + path);
  var doc = new libxml.Document(function(d) {
      d.node('D:multistatus', {"xmlns:D": "DAV:"}, function(n) {
        getLatestRevisionNumber(function(revNr) {
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
          listFilesInPath(path, revNr, function(files) {
            var filesProcessed = 0;
            if (files.length == 0) { res.send(doc.toString(), 404); return; };
            files.forEach(function (file) {
              n.node('D:response', {'xmlns:lp1': 'DAV:'}, function (n) {
                //n.node('D:href', 'http://' + req.header('Host') + path +  file);
                n.node('D:href', absPath + file);
                n.node('D:propstat', function(n) {
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
                    isDirectory(path + file, revNr, function(aBoolean) {
                      if (aBoolean) {
                        n.node('D:getcontenttype', 'httpd/unix-directory');
                        n.node('lp1:resourcetype', function(n) {
                          n.node('lp1:collection');
                        });
                      } else {
                        n.node('D:getcontenttype', mime.lookup(file));
                      }
                      if (++filesProcessed == files.length) {
                        //console.log('doc: ' + doc.toString());
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
  console.log('OPTIONS');
  res.header('MS-Author-Via', 'DAV');
  res.header('Vary: Accept-Encoding');
  res.header('DAV',  '1,2');
  res.header('DAV', '<http://apache.org/dav/propset/fs/1>');
  res.header('Content-Type', 'httpd/unix-directory');
  res.header('Allow', 'OPTIONS,GET,HEAD,POST,DELETE,TRACE,PROPFIND,PROPPATCH,COPY,MOVE,LOCK,UNLOCK');
  res.send('');
}



// startup
require('./routes/routes.js')(app, Controller);

app.listen(port);
