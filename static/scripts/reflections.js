function init_reflections() {
    function fract(x) {
        var xi = Math.floor(x);
        var xf = x - xi;
        return xf;
    }

    var lerp = QWQ.lerp;
    var clamp = QWQ.clamp;

    function hex_color(s) {
        return QWQ.color.hex_to_rgb(vec3.create(), s);
    }

    var colors = {
        bg0: hex_color('191E89'),
        bg1: hex_color('000000'),
        scape: hex_color('30A0FF')
    };
    vec3.scale(colors.bg0, colors.bg0, 1.00);

    function random(a, b) {
        return lerp(a, b, Math.random());
    }

    var textures = {
        scape: null
    };

    var programs = {
        arc2: webgl.get_program('arc2'),
        simple: webgl.get_program('simple'),
        landscape: webgl.get_program('landscape'),
        background: webgl.get_program('background')
    };

    var n_arcs = 25;
    var n_arc_verts = 256;
    var arcs = [];
    var n_circle_verts = 16;
    var n_circle_elems = 0;

    _.times(n_arcs, function() {
        arcs.push({
            params: vec4.fromValues(
                    3 * random(-1, 1),
                    0.2,
                    random(100, 1),
                    random(0.5, 3)),
            radius: random(0.01, 0.02)
        });
    });

    // (1) replicate the lines arcs with geom

    var buffers = {
        verts: null,
        elems: null,
        axes: webgl.new_vertex_buffer(new Float32Array([
            0, 0, 0, 1, 0, 0,
            0, 0, 0, 0, 1, 0,
            0, 0, 0, 0, 0, 1
        ])),
        arcs: null,
        circle_verts: null,
        circle_elems: null,
        quad: webgl.new_vertex_buffer(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]))
    };

    function make_arcs() {
        var verts = [];
        var elems = [];
        function make_circle() {
            for (var i = 0; i < n_circle_verts; ++i) {
                var u = 2*Math.PI*i/n_circle_verts;
                var x = Math.cos(u);
                var y = Math.sin(u);
                verts.push(x, y, 0);
                verts.push(x, y, 1);
                elems.push(2*i, 2*i + 1);
            }
            elems.push(0, 1);
            //console.log(verts.length);
            //console.log(elems);
        }
        make_circle();
        buffers.circle_verts = webgl.new_vertex_buffer(new Float32Array(verts));
        buffers.circle_elems = webgl.new_element_buffer(new Uint16Array(elems));
        n_circle_elems = elems.length;
    }
    make_arcs();

    var n_verts = 0;
    var n_elems = 0;

    function make_grid() {
        var n = 256;
        var verts = [];
        var elems = [];
        for (var row = 0; row < n; ++row) {
            for (var col = 0; col < n; ++col) {
                var u = col/(n-1);
                var v = row/(n-1);
                verts.push(u, v);
                if (row && col) {
                    var e1 = n*row + col;
                    var e0 = e1 - 1;
                    var e2 = e1 - n;
                    var e3 = e1 - n - 1;
                    elems.push(e0, e1, e2);
                    elems.push(e2, e3, e0);
                }
            }
        }
        n_verts = verts.length/2;
        n_elems = elems.length;
        buffers.verts = webgl.new_vertex_buffer(new Float32Array(verts));
        buffers.elems = webgl.new_element_buffer(new Uint16Array(elems));
    }
    make_grid();

    function make_scape_texture() {
        var n = 256;
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 256, 256, 0, gl.LUMINANCE, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);

        var data = new Float32Array(n*n);
        var dp = 0;
        for (var row = 0; row < n; ++row) {
            for (var col = 0; col < n; ++col) {
                var u = col/(n-1);
                var v = row/(n-1);
                var sc = 5;

                //var h = 0.2 + 3 * Math.pow(2*(u-0.5), 2);
                var h = 6*Math.sin(Math.PI*u) * (0.001 + Math.pow(2*(u-0.5),2));
                
                var y = h * (1 + noise.simplex2(sc*u, sc*v));

                //y += 0.10 * noise.simplex2(2*sc*u, 2*sc*v);
                //y += 0.05 * noise.simplex2(4*sc*u, 4*sc*v);

                data[dp++] = y;
            }
        }

        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, n, gl.LUMINANCE, gl.FLOAT, data);

        textures.scape = tex;
    }
    make_scape_texture();

    var time = -3;
    var mvp = mat4.create();
    var mat = mat4.create();
    var tmp = vec3.create();


    var ext = webgl.extensions.ANGLE_instanced_arrays;
    function draw_arcs2() {
        var pgm = programs.arc2.use();
        pgm.uniformMatrix4fv('mvp', mvp);
        pgm.uniform4f('color', 1.0, 1.0, 1.0, 1.0);
        pgm.uniform1f('time', time);
        pgm.uniform3fv('view_pos', camera.view_pos);
        light_params.setup(pgm);

        var attrib_index0 = pgm.enableVertexAttribArray('coord');
        ext.vertexAttribDivisorANGLE(attrib_index0, 1);

        webgl.bind_vertex_buffer(buffers.verts);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

        //webgl.bind_vertex_buffer(buffers.arcs);
        //pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

        webgl.bind_vertex_buffer(buffers.circle_verts);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);
        webgl.bind_element_buffer(buffers.circle_elems);

        gl.enable(gl.DEPTH_TEST);
        //gl.lineWidth(1);
        webgl.bind_vertex_buffer(buffers.arcs);
        for (var i = 0; i < n_arcs; ++i) {
            var arc = arcs[i];
            pgm.uniform4fv('arc', arc.params);
            pgm.uniform1f('radius', arc.radius);
            ext.drawElementsInstancedANGLE(
                gl.TRIANGLE_STRIP, n_circle_elems, gl.UNSIGNED_SHORT, 0,
                n_arc_verts);
        }

        ext.vertexAttribDivisorANGLE(attrib_index0, 0);
    }

    function make_stripe_matrix(scale, angle) {
        var m = mat2.create();
        mat2.scale(m, m, [scale, scale]);
        return mat2.rotate(m, m, QWQ.RAD_PER_DEG * angle);
    }

    var stripe_mat0 = make_stripe_matrix(2, 30);
    var stripe_mat1 = make_stripe_matrix(2, -40);

    function draw_scape() {
        var pgm = programs.landscape.use();
        pgm.uniformMatrix4fv('mvp', mvp);
        pgm.uniform4f('color', 1.0, 1.0, 1.0, 1.0);
        pgm.uniformSampler2D('t_scape', textures.scape);
        pgm.uniform1f('time', time);
        pgm.uniform3fv('view_pos', camera.view_pos);

        pgm.uniformMatrix2fv('stripe_mat0', stripe_mat0);
        pgm.uniformMatrix2fv('stripe_mat1', stripe_mat1);

        light_params.setup(pgm);

        webgl.bind_vertex_buffer(buffers.verts);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);
        gl.enable(gl.DEPTH_TEST);
        webgl.bind_element_buffer(buffers.elems);
        gl.drawElements(gl.TRIANGLES, n_elems, gl.UNSIGNED_SHORT, 0);
    }

    var light_params = (function() {
        var n_lights = 0;
        var params = null;

        function realloc(lights) {
            if (lights.length === n_lights)
                return;
            n_lights = lights.length;
            console.log('light_params: realloc', n_lights);
            params = {
                position: new Float32Array(3 * n_lights),
                direction: new Float32Array(3 * n_lights),
                direction2: new Float32Array(3 * n_lights),
                color: new Float32Array(3 * n_lights),
                falloff: new Float32Array(2 * n_lights)
            }
        }

        function update(lights) {
            realloc(lights);

            for (var i = 0; i < n_lights; ++i) {
                var l = lights[i];

                params.position[3*i + 0] = l.pos[0];
                params.position[3*i + 1] = l.pos[1];
                params.position[3*i + 2] = l.pos[2];

                params.direction[3*i + 0] = l.dir[0];
                params.direction[3*i + 1] = l.dir[1];
                params.direction[3*i + 2] = l.dir[2];

                params.direction2[3*i + 0] = l.dir2[0];
                params.direction2[3*i + 1] = l.dir2[1];
                params.direction2[3*i + 2] = l.dir2[2];

                params.color[3*i + 0] = l.color[0];
                params.color[3*i + 1] = l.color[1];
                params.color[3*i + 2] = l.color[2];

                params.falloff[2*i + 0] = Math.cos(QWQ.RAD_PER_DEG * 0.5 * l.fov);
                params.falloff[2*i + 1] = l.width;
            }
        }

        function setup(pgm) {
            pgm.uniform3fv('light_position[0]', params.position);
            pgm.uniform3fv('light_direction[0]', params.direction);
            pgm.uniform3fv('light_direction2[0]', params.direction2);
            pgm.uniform3fv('light_color[0]', params.color);
            pgm.uniform2fv('light_falloff[0]', params.falloff);
        }

        return {
            update: update,
            setup: setup
        };
    }());

    var axes_mvp = mat4.create();

    function draw_axes(mat) {
        var pgm = programs.simple.use();
        pgm.uniformMatrix4fv('mvp', mvp);
        webgl.bind_vertex_buffer(buffers.axes);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);
        pgm.uniform4f('color', 0.0, 1.0, 0.0, 1.0);

        mat4.multiply(axes_mvp, mvp, mat);
        pgm.uniformMatrix4fv('mvp', axes_mvp);

        gl.lineWidth(3);
        pgm.uniform4f('color', 1, 0, 0, 1);
        gl.drawArrays(gl.LINES, 0, 2);
        pgm.uniform4f('color', 0, 1, 0, 1);
        gl.drawArrays(gl.LINES, 2, 2);
        pgm.uniform4f('color', 0, 0.5, 1, 1);
        gl.drawArrays(gl.LINES, 4, 2);
        gl.lineWidth(1);
    }

    function Light() {
        this.pos = vec3.create();
        this.dir = vec3.fromValues(0, 0, 1);
        this.dir2 = vec3.create();
        this.color = vec3.fromValues(1, 1, 1);

        // angle in degrees
        this.fov = 30;
        this.width = 0.03;

        this.np = vec2.fromValues(Math.random(), Math.random());
    }

    Light.prototype.set_target = function(target) {
        vec3.sub(this.dir, target, this.pos);
        vec3.normalize(this.dir, this.dir);

        vec3.cross(this.dir2, this.dir, [0,1,0]);
        vec3.normalize(this.dir2, this.dir2);
        vec3.cross(this.dir2, this.dir, this.dir2);
        vec3.normalize(this.dir2, this.dir2);
    };

    Light.prototype.update = function(time) {
        tmp[0] = 10 * noise.simplex2(time, this.np[0]);
        tmp[1] = 0;
        tmp[2] = 10 * noise.simplex2(this.np[1], time);
        vec3.sub(this.dir, tmp, this.pos);
        vec3.normalize(this.dir, this.dir);

        vec3.cross(this.dir2, this.dir, [0,1,0]);
        vec3.normalize(this.dir2, this.dir2);
        vec3.cross(this.dir2, this.dir, this.dir2);
        vec3.normalize(this.dir2, this.dir2);
    };

    var lights = [];

    // global
    var l = new Light;
    vec3.set(l.pos, 03, 5, 10);
    l.set_target([1.1, 0, 5]);
    //vec3.set(l.color, 0.7, 1.0, 1.5);
    vec3.copy(l.color, colors.scape);
    vec3.scale(l.color, l.color, 0.8);

    l.fov = 50;
    lights.push(l);

    // spots
    var l = new Light;
    vec3.set(l.pos, -6, 3, 8);
    vec3.set(l.color, 1, 1.2, 0.3);
    vec3.scale(l.color, l.color, 20.0);
    lights.push(l);

    var l = new Light;
    vec3.set(l.pos, 6, 5, 7);
    vec3.set(l.color, 0.7, 1.0, 1.5);
    vec3.scale(l.color, l.color, 10.0);

    lights.push(l);


    function get_matrix(out, pos, dir, up) {
        vec3.add(tmp, pos, dir);
        mat4.lookAt(out, pos, tmp, up || [0,1,0]);
        return mat4.invert(out, out);
    }

    function draw_background() {
        gl.disable(gl.DEPTH_TEST);
        var pgm = programs.background.use();
        pgm.uniform3fv('color0', colors.bg1);
        pgm.uniform3fv('color1', colors.bg0);
        webgl.bind_vertex_buffer(buffers.quad);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function draw(env, player) {
        vec4.copy(camera.viewport, gl.getParameter(gl.VIEWPORT));
        mat4.copy(mvp, player ? camera.mvp : env.camera.mvp);

        _.each(lights, function(l, i) {
            i && l.update(time);
        });
        light_params.update(lights);

        draw_background();
        draw_scape();
        draw_arcs2();

        if (!player)  {
            get_matrix(mat, cam_pos, cam_dir);
            draw_axes(mat);
            _.each(lights, function(l, i) {
                get_matrix(mat, l.pos, l.dir);
                draw_axes(mat);
            });
        }
    }
    
    var cam_pos = vec3.fromValues(0, 0.45, 10);
    var cam_dir = vec3.fromValues(0, 0, -1);
    var cam_up = vec3.fromValues(0, 1, 0);
    var camera = new webgl.Camera;

    var cam_rot = quat.create();

    camera.fov = 80;

    var cam_look = vec2.create();
    var cam_time = 0;

    var secs_per_frame = 1.0/60;
    var beats_per_minute = 180;
    var beats_per_second = beats_per_minute / 60;
    var beats_per_frame = beats_per_second * secs_per_frame;

    function update(env) {
        var mx = env.mouse.pos_nd[0];
        var my = env.mouse.pos_nd[1];

        cam_look[0] = lerp(cam_look[0], -0.5 * mx, 0.05);

        var theta = noise.simplex2(0.25 * time, 0.123);
        theta = 0;
        theta += cam_look[0];

        var max_theta = 0.4;

        quat.identity(cam_rot);
        quat.rotateY(cam_rot, cam_rot, theta);

        // seconds per frame = 1.0/60

        // 60fps
        // 90bpm = ...

        var wobble = (1 + 0.5*noise.simplex2(0.05 * cam_time, 0.123));
        wobble = lerp(0.000, 0.050, wobble);
        var phi = wobble * Math.sin(cam_time);
        cam_time += Math.PI * beats_per_frame;

        cam_look[1] = lerp(cam_look[1], -0.5 * my, 0.05);
        phi += cam_look[1];
        quat.rotateX(cam_rot, cam_rot, phi);

        //cam_dir[2] = -Math.cos(theta);
        //cam_dir[0] = Math.sin(theta);



        //theta = 0;
        //cam_up[0] = 0;
        //cam_up[1] = Math.cos(theta);
        //cam_up[2] = Math.sin(theta);
        //vec3.normalize(cam_up, cam_up);

        vec3.set(cam_dir, 0, 0, -1);
        vec3.transformQuat(cam_dir, cam_dir, cam_rot);

        camera.update(cam_pos, cam_dir);
        time -= 0.005;
    }

    return {
        draw: draw,
        update: update
    };

}
