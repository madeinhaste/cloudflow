function main() {

    var canvas = new Canvas3D({
        antialias: false,
        extensions: [ 'OES_element_index_uint' ],
        sources: [ 'shaders/default.glsl' ]
    });
    canvas.show_grid = true;

    $('#main').prepend(canvas.el);
    window.onresize = () => canvas.redraw();

    key('g', function() {
        canvas.show_grid = !canvas.show_grid;
    });

    var params = { };

    var object = (function() {

        var programs = {
            simple: webgl.get_program('simple'),
        };
        
        var buffers = {
        };

        var textures = {
        };

        var mat = mat4.create();
        var mvp = mat4.create();

        function draw(env) {
            return;

            mat4.copy(mvp, env.camera.mvp);

            var pgm = programs.simple.use();
            pgm.uniformMatrix4fv('mvp', mvp);
            pgm.uniform4f('color', 0.5, 0.5, 0.5, 1.0);

            webgl.bind_vertex_buffer(buffers.position);
            pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.POINTS, 0, n_hair_points);
        }

        return {
            draw: draw,
        };

    }());

    canvas.draw = function() {
        object.draw(this);
    };

    function animate(t) {
        requestAnimationFrame(animate);
        canvas.redraw();
    }
    animate();

    0 && (function() {
        var gui = new dat.GUI();
        gui.add(params, 'my_param', 0, 1);
    }());

}

$(main);
