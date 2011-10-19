var express = require('express');
var DBWrapper = require('node-dbi').DBWrapper;
var log4js = require('log4js');
var config = require('./config');

var logger = log4js.getLogger();
logger.setLevel(config.logLevel);


var db = new DBWrapper('sqlite3', config.dbConfig);
db.connect(function(arg) {
  logger.info('db ' + (db._connected?'connected':'NOT connected'));
  });
logger.info('using database ' + config.dbConfig.path);

var app = express.createServer();

var proxy = require('./lib/proxy.js')(logger);
var codeDatabase = require('./lib/codedatabase.js')(db, logger);
var controller = require('./lib/controller.js')(codeDatabase, logger);

require('./lib/routes.js')(app, controller, logger, proxy);

app.listen(config.port);

