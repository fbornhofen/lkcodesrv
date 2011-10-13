var express = require('express');
var sqlite3 = require('sqlite3');
var mime = require('mime');
var libxml = require('libxmljs');
var dbPath = process.argv[2];
var port = 80;

console.log('using database ' + dbPath);
var db = new sqlite3.Database(dbPath);

var app = express.createServer();

// logic

function setupDb() {
  db.exec("DROP TABLE IF EXISTS files; CREATE TABLE files " +
          "(path string, revision int, timestamp int, user int, contents blob)");
}

function getFile(fileName, revNr, next) {
  db.serialize(function() {
    db.all("SELECT * FROM files WHERE path LIKE '" + fileName + "' AND revision = " +
        "(SELECT MAX(revision) FROM files WHERE path LIKE '" + fileName + "' AND revision <= " + 
        revNr + ")", 
      function (err, dbres) {
        if (err) {
          console.log("ERROR: getFile: " + err);
          return;
        }
        if (!dbres[0]) {
          console.log('WARNING: getFile ' + fileName + ' did not return any results');
        } else {
          console.log('getFile ' + fileName + ', revision ' + dbres[0]['revision']);
        }
        next(dbres);
      });
  });
}

function putFile(fileName, revNr, user, contents, next) {
  db.serialize(function() {
    var currentTime = new Date().getTime();
    // TODO hackhackhack clean this up
    var stmt = db.prepare("INSERT INTO files (path, revision, timestamp, user, contents) VALUES ('" + 
      fileName + "', " + revNr + ", " + currentTime + ", " + user + ", (?))");
    stmt.run(contents); 
    stmt.finalize(next);
  });
}

function getLatestRevisionNumber(next) {
  db.serialize(function() {
    db.all("SELECT MAX(revision) FROM files", function(err, dbres) {
      next(dbres[0]["MAX(revision)"]);
    });
  });
}

function listFilesInPath(path, revNr, next) {
  db.serialize(function() {
    db.all("SELECT path FROM files WHERE path LIKE '" + path + "%' AND revision <= " + revNr, function(err, dbres) {
      var children = {};
      if (err) {
        console.log(err);
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

function isDirectory(path, revNr, next) {
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

app.get('/setup', function(req, res) {
  setupDb();
  res.send('check if db has been set up successfully');
});

app.get('/latest', function(req, res) {
  getLatestRevisionNumber(function(revNr) {
    res.send(revNr + "\n");
  });
});

app.get(/\/list\/(\d+)\/(.*)/, function(req, res) {
  var path = req.params[1],
      rev = req.params[0];
  listFilesInPath(path, rev, function(dirEntries) {
    res.send(dirEntries.join("\n"));
  });
});

app.get(/\/isdir\/(\d+)\/(.*)/, function(req, res) {
  var path = req.params[1],
      rev = req.params[0];
  isDirectory(path, rev, function(aBoolean) {
    res.send(aBoolean);
  });
});

var sendFileFromDbRow = function(dbres, res) {
  if (dbres[0]) {
    res.header('Content-Type', mime.lookup(dbres[0].path));
    res.send(dbres[0]['contents']);
  } else {
    res.send('');
    return;
  }
}
app.get(/^\/(\d+)\/(.*)/, function(req, res) {
  var rev = req.params[0],
      file = req.params[1];
  getFile(file, rev, function(dbres) {sendFileFromDbRow(dbres, res);});
});
app.get(/^\/(.*)/, function(req, res) {
  var file = req.params[0];
  getLatestRevisionNumber(function(revNr) {
    getFile(file, revNr, function(dbres) {sendFileFromDbRow(dbres, res);});
  });
});


var evalJs = function(aString, response, onError) {
  try {
    var func = eval('(' + aString + ')');
    func(response);
  } catch (e) {
    return onError(JSON.stringify(e));
  }
}
app.post(/scheunentor/, function(req, res) {
  var funcString = '';
  var sendJson = function(json) {
    res.send(json);
  }
  if (req.body) {
    evalJs(req.body, res, sendJson); 
    return;
  }
  req.on('data', function(chunk) { funcString += chunk; });
  req.on('end', function() { evalJs(funcString, res, sendJson); });
});

var handlePostAndPut = function(req, res) {
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
// PUT / POST on paths containing revision numbers also create new revisions
app.post(/^\/\d+\/(.*)/, handlePostAndPut);
app.put(/^\/\d+\/(.*)/, handlePostAndPut);
app.post(/^\/(.*)/, handlePostAndPut);
app.put (/^\/(.*)/, handlePostAndPut);

// TODO new method
app.propfind(/\/(.*)/, function(req, res) {
  res.header('Content-Type', 'application/xml');
  var path = req.params[0],
    doc = new libxml.Document(function(d) {
      d.node('D:multistatus', {"xmlns:D": "DAV:"}, function(n) {
        getLatestRevisionNumber(function(revNr) {
          listFilesInPath(path, revNr, function(files) {
            var filesProcessed = 0;
            files.forEach(function (file) {
              n.node('D:status', 'HTTP/1.1 200 OK');
              n.node('D:response', {'xmlns:lp1': 'DAV:'}, function (n) {
                n.node('D:href', 'http://' + req.header('Host') + path +  file);
                n.node('D:propstat', function(n) {
                  n.node('D:prop', function(n) {
                    n.node('lp1:creationdate', '2011-10-04T23:05:34Z');
                    n.node('lp1:getlastmodified', '2011-10-04T23:05:34Z');
                    isDirectory(path + file, revNr, function(aBoolean) {
                      if (aBoolean) {
                        n.node('lp1:resourcetype', function(n) {
                          n.node('lp1:collection');
                        });
                      }
                      if (++filesProcessed == files.length) {
                        console.log('doc: ' + doc.toString());
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
});

var handleOptions = function(req, res) {
  console.log('OPTIONS');
  res.header('Content-Type', 'httpd/unix-directory');
  res.header('Allow', 'OPTIONS,GET,HEAD,POST,DELETE,TRACE,PROPFIND,PROPPATCH,COPY,MOVE,LOCK,UNLOCK');
  res.send('');
}
app.options(/\/(d+)\/(.*)/, function(req, res) {
  handleOptions(req, res);
});
app.options(/\/(.*)/, function(req, res) {
  handleOptions(req, res);
});


// startup

app.listen(port);
