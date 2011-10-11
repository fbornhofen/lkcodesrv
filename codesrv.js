var express = require('express');
var sqlite3 = require('sqlite3');
var dbPath = process.argv[2];

console.log('using database ' + dbPath);
var db = new sqlite3.Database(dbPath);

var app = express.createServer();

// logic

function setupDb() {
  db.exec("DROP TABLE IF EXISTS files; CREATE TABLE files " +
          "(path string, revision int, timestamp int, user int, contents blob)");
}

function getRevision(revNr, next) {
  db.serialize(function() {
    db.all("SELECT DISTINCT(path) FROM files WHERE revision = " + revNr, function(err, dbres) {
      if (err) {
        console.log(err);
        return;
      }
      next(dbres);
    });
  });
}

function getFile(fileName, revNr, next) {
  db.serialize(function() {
    console.log('getting ' + fileName + '(' + revNr + ')');
    db.all("SELECT * FROM files WHERE path like '" + fileName + "' AND revision = " + revNr, function (err, dbres) {
      if (err) {
        console.log(err);
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
      if (file.match(/.xhtml$/)) {
        // keep browsers from killing our CDATA sections, better: store content-type in db
        res.header('Content-Type', 'application/xhtml+xml');
      }
      res.send(dbres[0]['contents']);
    } else {
      res.send('');
      return;
    } 
  });
});

// TODO get on file name without revision number yields head revision

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

// startup

app.listen(3000);
