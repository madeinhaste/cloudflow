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
            'WEBKIT_WEBGL_compressed_texture_pvrtc',
            'EXT_shader_texture_lod',
            'ANGLE_instanced_arrays'
        ],
        sources: [
            'shaders/default.glsl',
            'shaders/textest.glsl',
            'shaders/cloud.glsl',
            'shaders/earth.glsl',
            'shaders/groove.glsl',
            'shaders/arc.glsl',
            'shaders/widget.glsl',
        ]
    });

    $('#main').prepend(canvas.el);

    var use_player_cam = false;
    var use_wireframe = false;
    key('space', function() { use_player_cam = !use_player_cam });

    var speedboard = init_speedboard();

    canvas.camera.far = 1000;

    var fps = new QWQ.FPS('#debug');

    canvas.draw = function() {
        speedboard.update(this, use_player_cam ? this.camera : null);

        if (use_player_cam) {
            gl.clearColor(0.7, 0.9, 1.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            //this.draw_grid();
        }

        speedboard.draw(this);
        fps.update();
    };

    canvas.pick = function() {
    };

    function animate(t) {
        canvas.time = t;
        requestAnimationFrame(animate);
        canvas._draw();
    }
    animate(0);

}

$(main);
