var USE_TEXLOD_FIX = false;

function main() {

    var canvas = new Canvas3D({
        antialias: true,
        extensions: [
            'OES_element_index_uint',
            'OES_texture_half_float',
            'OES_texture_half_float_linear',
            'OES_texture_float',
            'OES_texture_float_linear',
            'OES_standard_derivatives',
            'WEBGL_compressed_texture_s3tc',
            'EXT_shader_texture_lod',
        ],
        sources: [
            'shaders/default.glsl',
            'shaders/textest.glsl',
            'shaders/tunnel.glsl',
        ]
    });

    $('#main').prepend(canvas.el);

    var tunnel = new Tunnel;
    var fps = new QWQ.FPS('#debug');
    var use_player_cam = false;

    key('space', function() {
        use_player_cam = !use_player_cam;
    });

    canvas.draw = function() {
        tunnel.update(this, use_player_cam ? this.camera : null);
        tunnel.draw(this);
        fps.update();
    };

    canvas.pick = function() {
    };

    var t0 = performance.now();
    function animate(t) {
        requestAnimationFrame(animate);

        if (t) {
            var elapsed = t - t0;
            var dt = elapsed;
            canvas.dt = dt;
            t0 = t;
        }

        canvas._draw();
    }
    animate(0);

}

$(main);
