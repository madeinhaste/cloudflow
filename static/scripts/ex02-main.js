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

    var use_player_cam = true;
    var use_wireframe = false;
    key('space', function() { use_player_cam = !use_player_cam });

    //canvas.camera.fov = 40;

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
        var cloud_points = (function() {
            var v = [];
            var P = vec3.create();

            var F = vec3.create();
            var R = vec3.create();
            var M = mat4.create();

            var C0 = vec3.fromValues(0.9, 0, 0.7);
            var C1 = vec3.fromValues(0.2, 0.1, 1.0);
            var C = vec3.create();

            for (var i = 0; i < n_clouds; ++i) {
                var theta = -2*Math.PI*i/n_clouds;
                var height = QWQ.lerp(1.3, 1.4, Math.random());

                P[0] = 0;
                P[1] = height * Math.cos(theta);
                P[2] = height * Math.sin(theta);

                vec3.normalize(F, P);
                vec3.cross(R, F, [1,0,0]);
                vec3.normalize(R, R);

                mat4.identity(M);
                var rad = 2.0*(Math.random() - 0.5);
                mat4.rotate(M, M, rad, R);
                vec3.transformMat4(P, P, M);

                //QWQ.random.unit_vec3(P);
                //vec3.scale(P, P, QWQ.lerp(1.3, 1.5, Math.random()));
                var scale = 0.03 * QWQ.lerp(10.0, 20.0, Math.random());
                //scale = 0.05;
                //scale = 0.1;
                //var u = i/n_clouds;
                //scale = QWQ.lerp(0.05, 0.15, u);
                v.push(P[0], P[1], P[2], scale);

                vec3.lerp(C, C0, C1, Math.random());
                v.push(C[0], C[1], C[2], 1.0);
            }

            return v;
        }());

        var buffers = {
            cloud_points: webgl.new_vertex_buffer(new Float32Array(cloud_points)),
            cloud_rect: webgl.new_vertex_buffer(new Float32Array([ 0, 0, 1, 0, 0, 1, 1, 1 ])),
            cloud_rect_line: webgl.new_vertex_buffer(new Float32Array([ 0, 0, 1, 0, 1, 1, 0, 1 ])),
            axes: webgl.new_vertex_buffer(new Float32Array([
                0, 0, 0, 1, 0, 0,
                0, 0, 0, 0, 1, 0,
                0, 0, 0, 0, 0, 1
            ]))
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
            //pgm.uniform4f('color', 1.0, 1.0, 0.0, 1.0);
            pgm.uniformSampler2D('t_color', textures.cloud);
            pgm.uniform1f('aspect', 1709/1085);

            // non-instanced attrib
            webgl.bind_vertex_buffer(buffers.cloud_rect);
            pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

            // instanced attrib
            webgl.bind_vertex_buffer(buffers.cloud_points);

            var attrib_index0 = pgm.enableVertexAttribArray('position');
            gl.vertexAttribPointer(attrib_index0, 4, gl.FLOAT, false, 32, 0);
            ext.vertexAttribDivisorANGLE(attrib_index0, 1);

            var attrib_index1 = pgm.enableVertexAttribArray('color');
            gl.vertexAttribPointer(attrib_index1, 4, gl.FLOAT, false, 32, 16);
            ext.vertexAttribDivisorANGLE(attrib_index1, 1);

            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);

            gl.enable(gl.BLEND);
            //gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            //ext.drawArraysInstancedANGLE(gl.LINE_LOOP, 0, 4, n_clouds);
            ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, n_clouds);

            ext.vertexAttribDivisorANGLE(attrib_index0, 0);
            ext.vertexAttribDivisorANGLE(attrib_index1, 0);
        }

        function draw_earth(env) {
            var pgm = programs.simple.use();
            pgm.uniformMatrix4fv('mvp', env.camera.mvp);
            //pgm.uniform4f('color', 1.0, 0.5, 0.5, 0.5);
            pgm.uniform4f('color', 0.5, 0.5, 0.5, 1.0);
            pgm.uniform4f('color', 1.0, 1.0, 0.0, 1.0);

            webgl.bind_vertex_buffer(ob.buffers.position);
            pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

            //webgl.bind_element_buffer(ob.buffers.index);
            webgl.bind_element_buffer(ob.buffers.edge_index);

            //gl.enable(gl.DEPTH_TEST);
            gl.disable(gl.BLEND);
            gl.enable(gl.CULL_FACE);
            //gl.cullFace(gl.FRONT);

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
            scale: 0.05,

            theta: 0
        };

        var v0 = vec3.create();
        var v1 = vec3.create();

        function fract(x) {
            var xi = Math.floor(x);
            var xf = x - xi;
            return xf;
        }

        var mouserot = mat4.create();
        var MM = mat4.create();
        var D1 = vec3.create();
        var U1 = vec3.create();

        function update(env, camera) {
            // gravity
            //vec3.scaleAndAdd(player.vel, player.vel, player.pos, -0.0002);
            //vec3.scaleAndAdd(player.vel, player.vel, player.pos, -0.001);
            //vec3.scale(player.vel, player.vel, 0.9995);
            
            // accum
            //vec3.add(player.pos, player.pos, player.vel);
            
            var x = fract(2 * player.theta)
            var y = 1 - Math.pow(2*(x - 0.5), 2);
            var height = 1 + y;

            player.pos[0] = 0;
            player.pos[1] = height * Math.cos(player.theta);
            player.pos[2] = height * Math.sin(player.theta);

            player.theta += 0.002;

            

            // frame
            vec3.normalize(v0, player.pos);
            vec3.cross(v1, v0, player.dir);
            vec3.normalize(v1, v1);
            vec3.cross(v0, v1, v0);
            vec3.normalize(player.dir, v0);
            vec3.normalize(v0, player.pos);
            vec3.normalize(player.up, v0);


            // collide
            /*
            var l = vec3.length(player.pos);
            if (l < 1) {

                vec3.negate(player.vel, player.vel);
                vec3.scaleAndAdd(player.vel, player.vel, player.dir, 0.01);
                //vec3.scale(player.vel, player.vel, 1 + 1.5 * Math.random());
                vec3.scale(player.vel, player.vel, 1 + 0.1 * Math.random());
                vec3.normalize(player.pos, player.pos);
            }
            */

            if (camera) {
                var cw = canvas.el.width;
                var ch = canvas.el.height;

                var Q = 0.2;
                var rx = ((env.mouse.pos[0] / cw) - 0.5) * Q;
                var ry = ((env.mouse.pos[1] / ch) - 0.5) * Q;

                camera.update(player.pos, player.dir, player.up);

                mat4.invert(MM, camera.view);

                mat4.identity(mouserot);
                mat4.rotateX(mouserot, mouserot, ry);
                mat4.rotateY(mouserot, mouserot, rx);
                //mat4.rotateY(mouserot, mouserot, rx);

                mat4.multiply(MM, MM, mouserot);

                camera.update_mat(MM);

                //mat4.identity(mouserot);

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

            // axes
            webgl.bind_vertex_buffer(buffers.axes);
            pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

            mat4.identity(mat);
            mat4.translate(mat, mat, player.pos);
            var v = vec3.create();
            vec3.add(v, player.pos, player.dir);
            mat4.lookAt(mat, player.pos, v, player.up);
            mat4.invert(mat, mat);

            var sc = 0.25;
            mat4.scale(mat, mat, [sc, sc, sc]);
            mat4.multiply(mvp, env.camera.mvp, mat);
            pgm.uniformMatrix4fv('mvp', mvp);

            gl.lineWidth(3);
            pgm.uniform4f('color', 1, 0, 0, 1);
            gl.drawArrays(gl.LINES, 0, 2);
            pgm.uniform4f('color', 0, 1, 0, 1);
            gl.drawArrays(gl.LINES, 2, 2);
            pgm.uniform4f('color', 0, 0.5, 1, 1);
            gl.drawArrays(gl.LINES, 4, 2);
            gl.lineWidth(1);
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
            gl.clearColor(0, 0.5, 1.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            //this.draw_grid();
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
