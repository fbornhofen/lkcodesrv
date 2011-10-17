var express = require('express');
var sqlite3 = require('sqlite3');
var log4js = require('log4js');
var dbPath = process.argv[2];
var port = 80;

var logger = log4js.getLogger();
logger.setLevel('info');

logger.info('using database ' + dbPath);
var db = new sqlite3.Database(dbPath);

var app = express.createServer();

var codeDatabase = require('./lib/codedatabase.js')(db, logger);
var controller = require('./lib/controller.js')(codeDatabase, logger);
require('./lib/routes.js')(app, controller);

app.listen(port);
