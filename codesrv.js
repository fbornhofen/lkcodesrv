var express = require('express');
var sqlite3 = require('sqlite3');
var mime = require('mime');
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
    db.all("SELECT * FROM files WHERE path like '" + fileName + "' AND revision = " + revNr, function (err, dbres) {
      if (err) {
        console.log("getFile: " + err);
        return;
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

// TODO GET on file name without revision number yields head revision

var handlePostAndPut = function(req, res) {
  var path = req.params[0];
  var data = '';
  var writeData = function() {
    // TODO users, revisions
    putFile(path, 1, 0, data, function() {
      res.send('');})};
  if (req.body) { 
    data = req.body;
    putFile(path, 1, 0, data, writeData);
    return;
  }
  req.on('data', function(chunk) { data += chunk; });
  req.on('end', writeData);
};
app.post(/^\/(.*)/, handlePostAndPut);
app.put (/^\/(.*)/, handlePostAndPut);

// TODO directory listings if path is prefix


// startup

app.listen(port);
