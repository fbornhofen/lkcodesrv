module.exports = function(db, logger) {
  var CodeDatabase = {};

  var getDatabase = CodeDatabase.getDatabase = function() {
    return db;
  }

  var setupDb = CodeDatabase.setupDb = function() {
    //db.query("DROP TABLE IF EXISTS files; CREATE TABLE files " +
    db.query("CREATE TABLE files " +
            "(path string, revision int, timestamp int, user int, contents blob)",
      null,
      function(err) {if (err) {
          logger.error(err);
        }
      });
  }

  var getFile = CodeDatabase.getFile = function(fileName, revNr, next) {
    var continueWithEmptyResult = function(next) {
      next({isEmpty: true, contents: '', path: fileName, revision: revNr});
    }
    db.fetchAll("SELECT * FROM files WHERE path LIKE '" + fileName + "' AND revision = " +
        "(SELECT MAX(revision) FROM files WHERE path LIKE '" + fileName + "' AND revision <= " +
        revNr + ")", 
      null, 
      function (err, dbres) {
        if (err) {
          logger.error("getFile: " + err);
          continueWithEmptyResult(next);
        }
        if (!dbres[0]) {
          logger.warn('getFile ' + fileName + ' did not return any results');
          continueWithEmptyResult(next);
        } else {
          logger.info('getFile ' + fileName + ', revision ' + dbres[0]['revision']);
          next(dbres[0]);
        }
      });
  }

  var putFile = CodeDatabase.putFile = function(fileName, revNr, user, contents, next) {
    var insertObj = {
      path: fileName,
      revision: revNr,
      timestamp: new Date().getTime(),
      user: user,
      contents: contents
    };
    db.insert('files', insertObj, function(err) {
      if (err) {
        console.log(err);
      }});
  }

  var getLatestRevisionNumber = CodeDatabase.getLatestRevisionNumber = function(next) {
    db.fetchAll("SELECT MAX(revision) FROM files", function(err, dbres) {
      next(dbres[0]["MAX(revision)"]);
    });
  }

  var listFilesInPath = CodeDatabase.listFilesInPath = function(path, revNr, next) {
    logger.info('LIST ' + path);
    db.fetchAll("SELECT path FROM files WHERE path LIKE '" + path + "%' AND revision <= " + revNr, function(err, dbres) {
      var children = {};
      if (err) {
        logger.error(err);
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
  }

  var isDirectory = CodeDatabase.isDirectory = function(path, revNr, next) {
    db.fetchAll("SELECT path FROM files WHERE path LIKE '" + path + "/%' AND revision <= " + revNr, function(err, dbres) {
        if (err) {
          logger.error(err);
          return;
        }
        next(dbres.length > 0); // a path p is a directory if there are files in the db that are prefixed by p
      });
  }

  return CodeDatabase;

}
