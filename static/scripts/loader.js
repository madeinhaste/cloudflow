var cloudflow_loader = (function() {

    var todo = 0;
    var done = 0;

    var loader = {
        texture: load_texture,
        models: load_models,
        on_progress: function(done) {},
        on_complete: function() {}
    };

    function inc_resource(id) {
        ++todo;
        //console.log('todo:', ++todo);
    }

    function dec_resource(id) {
        --todo;
        loader.on_progress(++done);
        if (todo == 0) {
            console.log('ALL DONE!');
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

    // wrapper to observe loading progress
    function load_texture(path, opts) {
        var target = 3553; // TEXTURE_2D
        if (opts && opts.target)
            target = opts.target;

        inc_resource(path);
        return webgl.load_texture_ktx2(target, path, opts, function() {
            dec_resource(path);
        });
    }

    function load_models(path) {
        return wrap_promise(path, load_models_msgpack(path));
    }

    return loader;

}());
