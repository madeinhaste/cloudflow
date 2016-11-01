function main() {

    var canvas = new Canvas3D_v2({
        shaders: [ 'default', 'textest', 'cloud', 'earth', 'groove', 'arc', 'widget', 'meshflow' ]
    });

    $('#main').prepend(canvas.el);

    var use_player_cam = true;
    var use_wireframe = false;
    key('space', function() { use_player_cam = !use_player_cam });

    var meshflow = init_meshflow();
    meshflow.enter(false);

    Howler.mute(true);

    canvas.camera.far = 1000;
    canvas.camera.near = 0.01;

    var fps = new QWQ.FPS('#debug');

    canvas.draw = function() {
        meshflow.update(this, use_player_cam ? this.camera : null);

        if (use_player_cam) {
            gl.clearColor(0.7, 0.9, 1.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            //this.draw_grid();
        }

        meshflow.draw(this);
        fps.update();
    };

    canvas.pick = function() {
    };

    function animate(t) {
        requestAnimationFrame(animate);
        canvas._draw();
    }
    animate(0);

}

$(main);
