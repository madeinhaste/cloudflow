var USE_TEXLOD_FIX = false;

function main() {

    var canvas = new Canvas3D_v2({
        shaders: [ 'default', 'cloud', 'earth', 'particles', 'background' ]
    });

    $('#main').prepend(canvas.el);

    var use_player_cam = true;
    var use_wireframe = false;
    key('space', function() { use_player_cam = !use_player_cam });

    //canvas.camera.fov = 40;

    var clouds = init_clouds();
    var fps = new QWQ.FPS('#debug');

    canvas.draw = function() {
        clouds.update(this, use_player_cam ? this.camera : null);

        if (use_player_cam) {
            gl.clearColor(0, 0.5, 1.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            //this.draw_grid();
        }

        clouds.draw(this);
        fps.update();
    };

    canvas.pick = function() {
    };

    var t0 = performance.now();
    canvas.dt = 0.0;
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
