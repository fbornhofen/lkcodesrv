module.exports = function(app, controller) {

  var db = controller.getDatabase();
  
  // GET setup

  app.get('/setup', function(req, res) {
    controller.setupDb();
    res.send('check if db has been set up successfully');
  });

  // GET info
  
  app.get('/latest', function(req, res) {
    controller.getLatestRevisionNumber(function(revNr) {
      res.send(revNr + "\n");
    });
  });
  
  app.get(/\/list\/(\d+)\/(.*)/, function(req, res) {
    var path = req.params[1],
        rev = req.params[0];
    controller.listFilesInPath(path, rev, function(dirEntries) {
      res.send(dirEntries.join("\n"));
    });
  });
  
  app.get(/\/isdir\/(\d+)\/(.*)/, function(req, res) {
    var path = req.params[1],
        rev = req.params[0];
    controller.isDirectory(path, rev, function(aBoolean) {
      res.send(aBoolean);
    });
  });

  // GET stored files

  app.get(/^\/(\d+)\/(.*)/, function(req, res) {
    var rev = req.params[0],
        file = req.params[1];
    controller.getFile(file, rev, function(dbres) {controller.sendFileFromDbRow(dbres, res);});
  });
  app.get(/^\/(.*)/, function(req, res) {
    var file = req.params[0];
    controller.getLatestRevisionNumber(function(revNr) {
      controller.getFile(file, revNr, function(dbres) {controller.sendFileFromDbRow(dbres, res);});
    });
  });

  // POST JavaScript code

  app.post(/scheunentor/, function(req, res) {
    var funcString = '';
    var sendJson = function(json) {
      res.send(json);
    }
    if (req.body) {
      controller.evalJs(req.body, res, sendJson);
      return;
    }
    req.on('data', function(chunk) { funcString += chunk; });
    req.on('end', function() { controller.evalJs(funcString, res, sendJson); });
  });

  // POST or PUT files

  app.post(/^\/\d+\/(.*)/, controller.handlePostAndPut);
  app.put(/^\/\d+\/(.*)/, controller.handlePostAndPut);
  app.post(/^\/(.*)/, controller.handlePostAndPut);
  app.put (/^\/(.*)/, controller.handlePostAndPut);

  // PROPFIND
  
  app.propfind(/\/(.*)/, controller.propfindPath);

  // OPTIONS

  app.options(/\/(d+)\/(.*)/, controller.handleOptions);
  app.options(/\/(.*)/, controller.handleOptions);


};
