var cloudflow_loader = (function() {

    // wrapper to observe loading progress

    function load_texture(path, opts) {
        var target = 3553; // TEXTURE_2D
        if (opts && opts.target)
            target = opts.target;
        return webgl.load_texture_ktx2(target, path, opts);
    }

    function load_models(path) {
        return load_models_msgpack(path);
    }

    return {
        texture: load_texture,
        models: load_models
    };

}());
