#!/usr/bin/env node
var express = require('express');
var serve_static = require('serve-static');
var morgan = require('morgan');
var live_reload = require('express-livereload');

var assets_dirpath = __dirname + '/static';
var app = express();

app.use(morgan('dev'));
app.use(serve_static(assets_dirpath));

live_reload(app, {
    watchDir: assets_dirpath,
    exts: ['html', 'css', 'js', 'json', 'png', 'jpg', 'glsl']
});

var server = app.listen(8000, function() {
    console.log('HTTP server listening on', server.address().port);
});
