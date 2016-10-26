function init_clouds() {

    function hex_color(s) {
        var c = vec3.create();
        return QWQ.color.hex_to_rgb(c, s);
    }

    function make_gradient_texture() {
        // red - white - purple
        var colors0 = [ '#ff2a1a', '#ffffff', '#823c91' ];
        // gold - cornflower blue - white
        var colors1 = [ '#ffd463', '#5086fb', '#ffffff' ];

        var width = 256;

        var c = document.createElement('canvas');
        c.width = width;
        c.height = 2;

        var ctx = c.getContext('2d');

        function draw_row(y, colors) {
            var g = ctx.createLinearGradient(0, 0, width, 0);
            _.each(colors, function(c, i) {
                g.addColorStop(i/(colors.length - 1), c);
            });
            ctx.fillStyle = g;
            ctx.fillRect(0, y, width, 1);
        }

        draw_row(0, colors0);
        draw_row(1, colors1);

        var texture = webgl.new_texture({
            width: width,
            height: 2,
            format: gl.RGB,
            filter: gl.LINEAR
        });
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, c);
        return texture;
    }

    var sfx = [
        sounds.get('zgf/zgf-fx1'),
        sounds.get('zgf/zgf-fx2'),
        sounds.get('zgf/zgf-fx3'),
        sounds.get('zgf/zgf-fx4'),
        sounds.get('zgf/zgf-fx5'),
    ];

    var ob = null;
    cloudflow_loader.models('zgf.earth_v2')
        .then(function(data) {
            ob = data.Sphere;
        });

    // FIXME textures
    var textures = {
        cloud: cloudflow_loader.texture('zgf.cloud'),
        earth_nor: cloudflow_loader.texture('zgf.earth_nor', {wrap: gl.REPEAT}),
        gradient: make_gradient_texture()
    };

    var rry = 0;

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
            v.push(P[0], P[1], P[2], scale);

            //vec3.lerp(C, C0, C1, Math.random());
            //v.push(C[0], C[1], C[2], 1.0);
            v.push(Math.random());
        }

        return v;
    }());

    var n_particles = 1024;
    var particle_points = (function() {
        var v = [];
        var P = vec3.create();

        var F = vec3.create();
        var R = vec3.create();
        var M = mat4.create();

        for (var i = 0; i < n_particles; ++i) {
            var theta = -2*Math.PI*i/n_particles;
            var height = QWQ.lerp(1.3, 2.1, Math.random());

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
            var size = QWQ.lerp(1.0, 10.0, Math.random());
            v.push(P[0], P[1], P[2], size);
        }

        return v;
    }());

    var buffers = {
        cloud_points: webgl.new_vertex_buffer(new Float32Array(cloud_points)),
        particle_points: webgl.new_vertex_buffer(new Float32Array(particle_points)),
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
        earth: webgl.get_program('earth'),
        particles: webgl.get_program('particles')
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
        pgm.uniformSampler2D('t_gradient', textures.gradient);
        pgm.uniform1f('gradient_index', gradient_index);
        pgm.uniform1f('aspect', 1709/1085);

        // non-instanced attrib
        webgl.bind_vertex_buffer(buffers.cloud_rect);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

        // instanced attrib
        webgl.bind_vertex_buffer(buffers.cloud_points);

        var attrib_index0 = pgm.enableVertexAttribArray('position');
        gl.vertexAttribPointer(attrib_index0, 4, gl.FLOAT, false, 20, 0);
        ext.vertexAttribDivisorANGLE(attrib_index0, 1);

        var attrib_index1 = pgm.enableVertexAttribArray('color');
        gl.vertexAttribPointer(attrib_index1, 1, gl.FLOAT, false, 20, 16);
        ext.vertexAttribDivisorANGLE(attrib_index1, 1);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        gl.enable(gl.BLEND);
        //gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        //ext.drawArraysInstancedANGLE(gl.LINE_LOOP, 0, 4, n_clouds);

        //pgm.uniform1i('zpass', 1);
        //ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, n_clouds);
        
        gl.depthMask(false);
        //pgm.uniform1i('zpass', 0);
        ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, n_clouds);
        gl.depthMask(true);

        ext.vertexAttribDivisorANGLE(attrib_index0, 0);
        ext.vertexAttribDivisorANGLE(attrib_index1, 0);
    }

    function draw_particles(env) {
        var pgm = programs.particles.use();
        pgm.uniformMatrix4fv('mvp', env.camera.mvp);

        webgl.bind_vertex_buffer(buffers.particle_points);
        pgm.vertexAttribPointer('position', 4, gl.FLOAT, false, 0, 0);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        gl.depthMask(false);
        gl.drawArrays(gl.POINT, 0, n_particles);
        gl.depthMask(true);

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
    }

    var mat_earth = mat4.create();
    var mat_earth_normal = mat3.create();

    function draw_earth(env) {
        var pgm = programs.earth.use();
        pgm.uniformMatrix4fv('mvp', env.camera.mvp);
        pgm.uniformMatrix4fv('model_matrix', mat_earth);
        pgm.uniformMatrix3fv('normal_matrix', mat_earth_normal);
        pgm.uniform3fv('viewpos', env.camera.view_pos);
        pgm.uniformSampler2D('t_normal', textures.earth_nor);
        pgm.uniform1f('normal_scale', 50.0);
        pgm.uniform3f('color', 1.0, 1.0, 1.0);

        webgl.bind_vertex_buffer(ob.buffers.position);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_vertex_buffer(ob.buffers.normal);
        pgm.vertexAttribPointer('normal', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_vertex_buffer(ob.buffers.tangent);
        pgm.vertexAttribPointer('tangent', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_vertex_buffer(ob.buffers.texcoord);
        pgm.vertexAttribPointer('texcoord', 2, gl.FLOAT, false, 0, 0);

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        webgl.bind_element_buffer(ob.buffers.index);
        gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_SHORT, 0);
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

    var heights = [ 1.0, 1.2, 1.4, 1.1, 0.9 ];

    var last_x = 1;
    var bounce_at_x = 0.65;
    var target_gradient_index = 0.0;
    var gradient_index = 0.0;

    function update(env) {
        var old_camera = env.camera;
        env.camera = camera;

        // gravity
        //vec3.scaleAndAdd(player.vel, player.vel, player.pos, -0.0002);
        //vec3.scaleAndAdd(player.vel, player.vel, player.pos, -0.001);
        //vec3.scale(player.vel, player.vel, 0.9995);
        
        // accum
        //vec3.add(player.pos, player.pos, player.vel);
        
        var x = fract(1 * player.theta);

        if (last_x > x)
            target_gradient_index = 1.0 - target_gradient_index;
        gradient_index = QWQ.lerp(gradient_index, target_gradient_index, 0.01);

        if (last_x < bounce_at_x && x > bounce_at_x) {
            // sound effect on bounce
            _.sample(sfx).play();
            //bounce_at_x = QWQ.lerp(0.6, 0.8, Math.random());
        }
        last_x = x;



        var y;
        if (x < 0.5) {
            y = Math.sin(2*x*Math.PI);
            y = Math.pow(y, 1.000);
        } else {
            y = Math.sin(2*(x-0.5)*Math.PI);
            y = Math.pow(y, 0.125);
            y = -y;
        }

        y = (1 + y)/2;

        //var y = 0.5 + 0.5*Math.sin(2 * Math.PI * x);
        //var y = 1 - Math.pow(2*(x - 0.5), 2);

        var height = 1.0 + y * (heights[Math.floor(player.theta) % heights.length]);
        rry = y;
        rry = 0;

        //height = 1.0;

        player.pos[0] = 0;
        player.pos[1] = height * Math.cos(player.theta);
        player.pos[2] = height * Math.sin(player.theta);

        player.theta += 0.005;
        //player.theta += 0.001;

        

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
            var cw = env.el.width;
            var ch = env.el.height;

            var Q = 0.2;
            var rx = Q * env.mouse.pos_nd[0];
            var ry = Q * env.mouse.pos_nd[1];

            //rx = ry = 0;

            ry += -rry;

            camera.update(player.pos, player.dir, player.up);
            mat4.invert(MM, camera.view);

            mat4.identity(mouserot);
            mat4.rotateX(mouserot, mouserot, ry);
            mat4.rotateY(mouserot, mouserot, rx);

            mat4.multiply(MM, MM, mouserot);

            camera.update_mat(MM);

            //mat4.identity(mouserot);

        }

        env.camera = old_camera;
    }

    var camera = new webgl.Camera;
    camera.fov = 60;
    camera.far = 800;

    var bg = hex_color('3493ae');

    function draw(env) {
        if (!ob) return;

        var old_camera = env.camera;
        env.camera = camera;
        vec4.copy(camera.viewport, gl.getParameter(gl.VIEWPORT));

        gl.clearColor(bg[0], bg[1], bg[2], 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        draw_earth(env);
        draw_clouds(env);
        draw_particles(env);

        env.camera = old_camera;
    }

    return {
        draw: draw,
        update: update
    };

}
