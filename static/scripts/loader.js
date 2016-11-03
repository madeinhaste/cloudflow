var cloudflow_loader = (function() {

    var todo = 0;
    var done = 0;

    var loader = {
        texture: load_texture,
        models: load_models,
        on_progress: function(done) {},
        on_complete: function() {}
    };

    var start_times = {};

    function time_start(id) {
        start_times[id] = performance.now();
    }

    function time_end(id) {
        var now = performance.now();
        var elapsed = now - start_times[id];
        //console.log('loader:', id, Math.round(elapsed)+'ms');
    }

    time_start('*ALL*');

    function inc_resource(id) {
        ++todo;
        time_start(id);
        //console.log('todo:', ++todo);
    }

    function dec_resource(id) {
        --todo;
        time_end(id);
        loader.on_progress(++done);
        if (todo == 0) {
            //console.log('ALL DONE!', done);
            time_end('*ALL*');
            loader.on_complete();
        }
    }

    function wrap_promise(id, promise) {
        inc_resource(id);
        return promise.then(function(result) {
            dec_resource(id);
            return result;
        });
    }
    
    function slash(id) {
        return id.replace(/\./g, '/');
    }

    // wrapper to observe loading progress
    function load_texture(id, opts) {
        var target = 3553; // TEXTURE_2D
        if (opts && opts.target)
            target = opts.target;

        inc_resource(id);
        var path = 'data/textures/' + slash(id);
        return webgl.load_texture_ktx2(target, path, opts, function() {
            dec_resource(id);
        });
    }

    function load_models(id) {
        var path = 'data/models/' + slash(id) + '.msgpack.br';
        return wrap_promise(id, load_models_msgpack(path));
    }

    return loader;

}());
