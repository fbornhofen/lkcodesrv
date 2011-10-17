module.exports = function(db) {
  var CodeDatabase = {};

  var getDatabase = CodeDatabase.getDatabase = function() {
    return db;
  }

  var setupDb = CodeDatabase.setupDb = function() {
    db.exec("DROP TABLE IF EXISTS files; CREATE TABLE files " +
            "(path string, revision int, timestamp int, user int, contents blob)");
  }

  var getFile = CodeDatabase.getFile = function(fileName, revNr, next) {
    var continueWithEmptyResult = function(next) {
      next({isEmpty: true, contents: '', path: fileName, revision: revNr});
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
            next(dbres[0]);
          }
        });
    });
  }

  var putFile = CodeDatabase.putFile = function(fileName, revNr, user, contents, next) {
    db.serialize(function() {
      var currentTime = new Date().getTime();
      // TODO hackhackhack clean this up
      var stmt = db.prepare("INSERT INTO files (path, revision, timestamp, user, contents) VALUES ('" +
        fileName + "', " + revNr + ", " + currentTime + ", " + user + ", (?))");
      stmt.run(contents);
      stmt.finalize(next);
    });
  }

  var getLatestRevisionNumber = CodeDatabase.getLatestRevisionNumber = function(next) {
    db.serialize(function() {
      db.all("SELECT MAX(revision) FROM files", function(err, dbres) {
        next(dbres[0]["MAX(revision)"]);
      });
    });
  }

  var listFilesInPath = CodeDatabase.listFilesInPath = function(path, revNr, next) {
    console.log('LIST ' + path);
    db.serialize(function() {
      db.all("SELECT path FROM files WHERE path LIKE '" + path + "%' AND revision <= " + revNr, function(err, dbres) {
        var children = {};
        if (err) {
          console.log(err);
          next([]);
          return;
        }
        dbres.forEach(function(ea) {
          var curPath = ea['path'];
          if (path !== '') { // root
            curPath = ea['path'].substring(path.length + (path[path.length-1]=='/'?0:1));
          }
          var firstLevelNode = curPath.split('/')[0];
          children[firstLevelNode] = firstLevelNode;
        });
        var result = [];
        for (var prop in children) { result.push(children[prop]); }
        next(result);
      });
    });
  }

  var isDirectory = CodeDatabase.isDirectory = function(path, revNr, next) {
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

  return CodeDatabase;

}
