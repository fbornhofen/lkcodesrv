var express = require('express');
var sqlite3 = require('sqlite3');
//var mime = require('mime');
//var libxml = require('libxmljs');
var dbPath = process.argv[2];
var port = 80;

console.log('using database ' + dbPath);
var db = new sqlite3.Database(dbPath);

var app = express.createServer();

var codeDatabase = require('./lib/codedatabase.js')(db);
var controller = require('./lib/controller.js')(codeDatabase);
require('./lib/routes.js')(app, controller);

app.listen(port);
