var express = require('express');
var sqlite3 = require('sqlite3');
var db = new sqlite3.Database('/home/fb/sw/codesrv/codedb.sqlite3');

var app = express.createServer();

// logic

function setupDb() {
  db.exec("DROP TABLE IF EXISTS files; CREATE TABLE files " +
          "(path string, revision int, timestamp int, user int, contents blob)");
}

function getRevision(revNr, continuation) {
  db.serialize(function() {
    db.all("SELECT DISTINCT(path) FROM files WHERE revision = " + revNr, function(err, dbres) {
      if (err) {
        console.log(err);
        return;
      }
      continuation(dbres);
    });
  });
}

function getFile(fileName, revNr, continuation) {
  db.serialize(function() {
    console.log('getting ' + fileName + '(' + revNr + ')');
    db.all("SELECT * FROM files WHERE path like '" + fileName + "' AND revision = " + revNr, function (err, dbres) {
      if (err) {
        console.log(err);
        return;
      }
      continuation(dbres);
    });
  });
}

// controller

app.get('/setup', function(req, res) {
  setupDb();
  res.send('check if db has been set up successfully');
});

app.get('/:rev', function(req, res) {
  getRevision(req.params.rev, function(dbres) {
    var resStr = ''
    resStr = JSON.stringify(dbres);
    res.send(resStr);
  });
});

app.get(/^\/(\d+)\/(.*)/, function(req, res) {
  var rev = req.params[0],
      file = req.params[1];
  getFile(file, rev, function(dbres) {
    if (dbres[0]) {
      res.send(dbres[0]['contents']);
    } else {
      res.send('');
      return;
    } 
  });
});

app.post(/^\/(.*)/, function(req, res) {
  var path = req.params[0];
  var data = '';
  var respond = function() {res.send(''); console.log(data);};
  if (req.body) { 
    data = req.body;
    respond();
    return;
  }
  req.on('data', function(chunk) { data += chunk; });
  req.on('end', respond);
});


// startup

app.listen(3000);
