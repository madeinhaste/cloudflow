#!/usr/bin/env node
var express = require('express');
var serve_static = require('serve-static');
var morgan = require('morgan');
var glob = require('glob');

process.EventEmitter = require('events');
var live_reload = require('express-livereload');

var raw_body_parser = require('raw-body-parser');
var fs = require('fs');
var argv = require('yargs').argv;
var async = require('async');
var _ = require('lodash');

var assets_dirpath = __dirname + (argv.build ? '/build' : '/static');
var app = express();

app.use(morgan('dev'));

1 && app.use('/data/shaders.json', function(req, res) {
    get_shader_sources(function(err, sources) {
        res.send(sources);
    });
});

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

function get_shader_sources(callback) {

    glob(assets_dirpath + '/shaders/*.glsl', function(err, paths) {
        async.map(paths,
            (path, cb) => fs.readFile(path, 'utf8', cb),
            function(err, texts) {
                if (err)
                    return callback(err, null);

                var shaderSources = {};
                texts.forEach(source => {
                    processSourceText(shaderSources, source);
                });

                // concatenate lines
                _.each(shaderSources, function(source, key) {
                    shaderSources[key] = source.join('\n');
                });

                fs.writeFile(assets_dirpath + '/data/shaders.json',
                    JSON.stringify(shaderSources),
                    err => { err && console.warn('couldn\'t write shaders.json:', err) });

                callback(null, shaderSources);
            }
        )
    });

    function each_line(text, callback) {
        var sp = 0;
        var lineno = 0;
        while (sp < text.length) {
            var ep = text.indexOf('\n', sp);
            if (ep == -1)
                ep = text.length;

            var line = text.substr(sp, ep - sp);
            sp = ep + 1;

            callback(line, lineno++);
        }
    }

    function processSourceText(shaderSources, text) {
        var regex = /^\/\/\s*(\w+(?:.(vertex|fragment))?)\s*\/\//;
        var source = [];
        each_line(text,  function(line) {
            var m = regex.exec(line);
            if (m) {
                var key = m[1];
                shaderSources[key] = source = [];
            } else {
                source.push(line);
            }
        });
    }

}

