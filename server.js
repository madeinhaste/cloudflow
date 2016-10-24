#!/usr/bin/env node
var express = require('express');
var serve_static = require('serve-static');
var morgan = require('morgan');
var live_reload = require('express-livereload');
var raw_body_parser = require('raw-body-parser');
var fs = require('fs');
var argv = require('yargs').argv;

var assets_dirpath = __dirname + (argv.build ? '/build' : '/static');
var app = express();

app.use(morgan('dev'));
app.use(serve_static(assets_dirpath));

// http://stackoverflow.com/questions/9920208/expressjs-raw-body
app.post('/save/*', raw_body_parser(), function(req, res) {
    var filepath = req.params[0];
    var data = req.rawBody;
    fs.writeFileSync(filepath, data);
    console.log(filepath, data.length);
    res.send('ok');
});


live_reload(app, {
    watchDir: assets_dirpath,
    exts: ['html', 'css', 'js', 'json', 'png', 'jpg', 'glsl']
});

var server = app.listen(8000, function() {
    console.log('HTTP server listening on', server.address().port);
});
