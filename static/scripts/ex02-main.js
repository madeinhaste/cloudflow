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
            'ANGLE_instanced_arrays'
        ],
        sources: [
            'shaders/default.glsl',
            'shaders/textest.glsl',
            'shaders/tunnel.glsl',
            'shaders/cloud.glsl',
        ]
    });

    $('#main').prepend(canvas.el);

    var use_player_cam = false;
    var use_wireframe = false;
    //key('space', function() { use_player_cam = !use_player_cam });


    var clouds = (function() {

        var ob = null;
        load_objects('data/sphere.msgpack').then(function(obs) {
            ob = obs.Icosphere;
        });

        var textures = {
            cloud: webgl.load_texture('images/cloud.jpg', {mipmap: 1, flip: 1})
        };

        // so now we want a bunch of points, randomly distributed around the sphere
        var n_clouds = 1000;
        var v = [];
        var P = vec3.create();
        for (var i = 0; i < n_clouds; ++i) {
            QWQ.random.unit_vec3(P);
            vec3.scale(P, P, QWQ.lerp(1.5, 2.5, Math.random()));
            var scale = 0.02 * QWQ.lerp(1.0, 20.0, Math.random());
            v.push(P[0], P[1], P[2], scale);
        }

        var buffers = {
            cloud_points: webgl.new_vertex_buffer(new Float32Array(v)),
            cloud_rect: webgl.new_vertex_buffer(new Float32Array([ 0, 0, 1, 0, 0, 1, 1, 1 ])),
            cloud_rect_line: webgl.new_vertex_buffer(new Float32Array([ 0, 0, 1, 0, 1, 1, 0, 1 ]))
        };

        var programs = {
            simple: webgl.get_program('simple'),
            cloud: webgl.get_program('cloud'),
        };

        var mat = mat4.create();
        var mvp = mat4.create();

        var ext = webgl.extensions.ANGLE_instanced_arrays;

        function draw_clouds(env) {
            var pgm = programs.cloud.use();
            pgm.uniformMatrix4fv('mvp', env.camera.mvp);
            pgm.uniformMatrix3fv('bill', env.camera.bill);
            pgm.uniform4f('color', 1.0, 1.0, 0.0, 1.0);
            pgm.uniformSampler2D('t_color', textures.cloud);
            pgm.uniform1f('aspect', 1709/1085);

            // non-instanced attrib
            webgl.bind_vertex_buffer(buffers.cloud_rect);
            pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

            // instanced attrib
            webgl.bind_vertex_buffer(buffers.cloud_points);
            var attrib_index = pgm.enableVertexAttribArray('position');
            gl.vertexAttribPointer(attrib_index, 4, gl.FLOAT, false, 0, 0);
            ext.vertexAttribDivisorANGLE(attrib_index, 1);

            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

            //ext.drawArraysInstancedANGLE(gl.LINE_LOOP, 0, 4, n_clouds);
            ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, n_clouds);

            ext.vertexAttribDivisorANGLE(attrib_index, 0);
        }

        function draw_earth(env) {
            var pgm = programs.simple.use();
            pgm.uniformMatrix4fv('mvp', env.camera.mvp);
            pgm.uniform4f('color', 1.0, 0.5, 0.5, 0.5);

            webgl.bind_vertex_buffer(ob.buffers.position);
            pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

            //webgl.bind_element_buffer(ob.buffers.index);
            webgl.bind_element_buffer(ob.buffers.edge_index);

            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.FRONT);

            //gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);
            gl.drawElements(gl.LINES, ob.edge_index_count, gl.UNSIGNED_INT, 0);
        }

        var player = {
            pos: vec3.fromValues(0, 1.2, 0),
            dir: vec3.fromValues(0, 0, 1),
            vel: vec3.fromValues(0, 0, 0),
            up: vec3.fromValues(0, 1, 0),
            mat: mat4.create(),
            mvp: mat4.create(),
            scale: 0.05
        };

        var v0 = vec3.create();
        var v1 = vec3.create();

        function update(env, camera) {
            // gravity
            vec3.scaleAndAdd(player.vel, player.vel, player.pos, -0.0002);
            //vec3.scaleAndAdd(player.vel, player.vel, player.pos, -0.001);
            vec3.scale(player.vel, player.vel, 0.9995);
            
            // accum
            vec3.add(player.pos, player.pos, player.vel);

            // collide
            var l = vec3.length(player.pos);
            if (l < 1) {
                vec3.normalize(v0, player.pos);
                vec3.cross(v1, v0, player.dir);
                vec3.normalize(v1, v1);
                vec3.cross(v0, v1, v0);
                vec3.normalize(player.dir, v0);


                vec3.normalize(v0, player.pos);
                //vec3.negate(player.up, v0);


                vec3.negate(player.vel, player.vel);
                vec3.scaleAndAdd(player.vel, player.vel, player.dir, 0.01);
                //vec3.scale(player.vel, player.vel, 1 + 1.5 * Math.random());
                vec3.scale(player.vel, player.vel, 1 + 0.1 * Math.random());
                vec3.normalize(player.pos, player.pos);
            }

            if (camera) {
                camera.update(player.pos, player.dir, player.up);
            }
        }

        function draw_player(env) {
            var mat = player.mat;
            var mvp = player.mvp;
            mat4.identity(mat);
            mat4.translate(mat, mat, player.pos);

            var sc = player.scale;
            mat4.scale(mat, mat, [sc, sc, sc]);
            mat4.multiply(mvp, env.camera.mvp, mat);

            var pgm = programs.simple.use();
            pgm.uniformMatrix4fv('mvp', mvp);
            pgm.uniform4f('color', 0.0, 1.0, 0.0, 1.0);

            webgl.bind_vertex_buffer(ob.buffers.position);
            pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);
            webgl.bind_element_buffer(ob.buffers.edge_index);

            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);
            gl.disable(gl.BLEND);
            gl.drawElements(gl.LINES, ob.edge_index_count, gl.UNSIGNED_INT, 0);

        }

        function draw(env) {
            if (!ob) return;
            draw_earth(env);
            draw_clouds(env);
            draw_player(env);
        }

        return {
            draw: draw,
            update: update
        };

    }());


    canvas.draw = function() {
        clouds.update(this, use_player_cam ? this.camera : null);

        if (use_player_cam) {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            this.draw_grid();
        }

        clouds.draw(this);
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
