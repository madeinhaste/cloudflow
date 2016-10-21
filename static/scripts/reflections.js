function init_reflections() {
    function fract(x) {
        var xi = Math.floor(x);
        var xf = x - xi;
        return xf;
    }

    var textures = {
        scape: null
    };

    var programs = {
        arc: webgl.get_program('arc'),
        arc2: webgl.get_program('arc2'),
        simple: webgl.get_program('simple'),
        landscape: webgl.get_program('landscape')
    };

    var n_arcs = 25;
    var n_arc_verts = 256;
    var arcs = [];
    var n_circle_verts = 16;
    var n_circle_elems = 0;

    _.times(n_arcs, function() {
        arcs.push(vec4.fromValues(
                    3 * QWQ.lerp(-1, 1, Math.random()),
                    0.2,
                    QWQ.lerp(100, 1, Math.random()),
                    QWQ.lerp(0.5, 3, Math.random())));
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
        circle_elems: null
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


        // arcs
        var out = new Float32Array(8 * n_arcs * n_arc_verts);
        var dp = 0;

        var T = vec3.create();
        var Q = quat.create();

        for (var i = 0; i < n_arcs; ++i) {
            var arc = arcs[i];
            var time = -10;

            var dp0 = dp;
            for (var j = 0; j < n_arc_verts; ++j) {
                var u = j / (n_arc_verts - 1);
                var z = arc[2] + 2.0 * time;
                var x = fract(2.0*u + z);
                var y = 1.0 - Math.pow(2.0*(x - 0.5), 2.0);
                y *= arc[3];    // height
                y += arc[1];    // offset y

                out[dp + 0] = arc[0];
                out[dp + 1] = y;
                out[dp + 2] = u*10 + z;
                out[dp + 3] = 0;

                dp += 8;
            }

            var dp = dp0;
            for (var j = 0; j < n_arc_verts; ++j) {
                T[0] = 0;
                T[1] = 0;
                T[2] = 0;

                if (j > 0) {
                    T[0] += out[dp + 0] - out[dp - 8];
                    T[1] += out[dp + 1] - out[dp - 7];
                    T[2] += out[dp + 2] - out[dp - 6];
                }

                if (j < n_arc_verts-1) {
                    T[0] += out[dp + 8] - out[dp + 0];
                    T[1] += out[dp + 9] - out[dp + 1];
                    T[2] += out[dp + 10] - out[dp + 2];
                }

                vec3.normalize(T, T);
                quat.rotationTo(Q, [0,0,1], T);
                quat.normalize(Q, Q);

                out[dp + 4] = Q[0];
                out[dp + 5] = Q[1];
                out[dp + 6] = Q[2];
                out[dp + 7] = Q[3];

                dp += 8;
            }
        }

        buffers.arcs = webgl.new_vertex_buffer(new Float32Array(out));
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
        buffers.elems = webgl.new_element_buffer(new Uint32Array(elems));
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
                var h = 6*Math.sin(Math.PI*u) * (0.01 + Math.pow(2*(u-0.5),2));
                
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

    var time = 0.0;
    var mvp = mat4.create();
    var mat = mat4.create();
    var tmp = vec3.create();


    function draw_arcs() {
        var pgm = programs.arc.use();
        pgm.uniformMatrix4fv('mvp', mvp);
        pgm.uniform4f('color', 1.0, 1.0, 1.0, 1.0);
        pgm.uniform1f('time', time);

        webgl.bind_vertex_buffer(buffers.verts);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

        gl.enable(gl.DEPTH_TEST);
        gl.lineWidth(4);

        _.each(arcs, function(pos) {
            pgm.uniform4fv('pos', pos);
            gl.drawArrays(gl.LINE_STRIP, 0, 256);
        });

        gl.lineWidth(1);
    }

    var ext = webgl.extensions.ANGLE_instanced_arrays;
    function draw_arcs2() {
        var pgm = programs.arc2.use();
        pgm.uniformMatrix4fv('mvp', mvp);
        pgm.uniform4f('color', 1.0, 1.0, 1.0, 1.0);
        light_params.setup(pgm);

        var attrib_index0 = pgm.enableVertexAttribArray('position0');
        ext.vertexAttribDivisorANGLE(attrib_index0, 1);
        var attrib_index1 = pgm.enableVertexAttribArray('rotation0');
        ext.vertexAttribDivisorANGLE(attrib_index1, 1);

        var attrib_index2 = pgm.enableVertexAttribArray('position1');
        ext.vertexAttribDivisorANGLE(attrib_index2, 1);
        var attrib_index3 = pgm.enableVertexAttribArray('rotation1');
        ext.vertexAttribDivisorANGLE(attrib_index3, 1);

        webgl.bind_vertex_buffer(buffers.circle_verts);
        pgm.vertexAttribPointer('coord', 3, gl.FLOAT, false, 0, 0);
        webgl.bind_element_buffer(buffers.circle_elems);

        gl.enable(gl.DEPTH_TEST);
        //gl.lineWidth(1);
        webgl.bind_vertex_buffer(buffers.arcs);
        for (var i = 0; i < n_arcs; ++i) {
            var stride = 8 * 4;
            var offset = i * n_arc_verts * stride;
            gl.vertexAttribPointer(attrib_index0, 3, gl.FLOAT, false, stride, offset);
            gl.vertexAttribPointer(attrib_index1, 4, gl.FLOAT, false, stride, offset + 4*4);

            gl.vertexAttribPointer(attrib_index2, 3, gl.FLOAT, false, stride, offset + 8*4);
            gl.vertexAttribPointer(attrib_index3, 4, gl.FLOAT, false, stride, offset + 12*4);

            /*
            ext.drawArraysInstancedANGLE(
                gl.POINTS,
                0,
                2*n_circle_verts,
                n_arc_verts-1);
                */
            ext.drawElementsInstancedANGLE(
                gl.TRIANGLE_STRIP,
                n_circle_elems,
                gl.UNSIGNED_SHORT,
                0,
                n_arc_verts-1);
        }
        //gl.lineWidth(1);

        ext.vertexAttribDivisorANGLE(attrib_index0, 0);
        ext.vertexAttribDivisorANGLE(attrib_index1, 0);
        ext.vertexAttribDivisorANGLE(attrib_index2, 0);
        ext.vertexAttribDivisorANGLE(attrib_index3, 0);
    }

    function draw_scape() {
        var pgm = programs.landscape.use();
        pgm.uniformMatrix4fv('mvp', mvp);
        pgm.uniform4f('color', 1.0, 1.0, 1.0, 1.0);
        pgm.uniformSampler2D('t_scape', textures.scape);
        pgm.uniform1f('time', time);
        pgm.uniform3fv('view_pos', camera.view_pos);

        light_params.setup(pgm);

        webgl.bind_vertex_buffer(buffers.verts);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);
        gl.enable(gl.DEPTH_TEST);
        webgl.bind_element_buffer(buffers.elems);
        gl.drawElements(gl.TRIANGLES, n_elems, gl.UNSIGNED_INT, 0);
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
    vec3.set(l.pos, 1, 1, 20);
    vec3.set(l.dir, 0, 0, -1);
    vec3.set(l.color, 1, 1, 1);
    vec3.scale(l.color, l.color, 0.3);
    l.fov = 50;
    lights.push(l);

    // spots
    var l = new Light;
    vec3.set(l.pos, -6, 3, 8);
    vec3.set(l.color, 1, 0.2, 0);
    lights.push(l);

    var l = new Light;
    vec3.set(l.pos, 6, 5, 7);
    vec3.set(l.color, 0, 0.9, 0.65);
    lights.push(l);


    function get_matrix(out, pos, dir, up) {
        vec3.add(tmp, pos, dir);
        mat4.lookAt(out, pos, tmp, up || [0,1,0]);
        return mat4.invert(out, out);
    }

    function draw(env) {
        mat4.copy(mvp, env.camera.mvp);

        _.each(lights, function(l, i) {
            i && l.update(time);
        });
        light_params.update(lights);

        draw_scape();
        draw_arcs2();

        // debug widgetsj
        get_matrix(mat, cam_pos, cam_dir);
        draw_axes(mat);
        _.each(lights, function(l, i) {
            get_matrix(mat, l.pos, l.dir);
            draw_axes(mat);
        });
    }
    
    var cam_pos = vec3.fromValues(0, 0.35, 10);
    var cam_dir = vec3.fromValues(0, 0, -1);
    var camera = new webgl.Camera;
    camera.fov = 80;

    function update(env, cam) {
        var theta = noise.simplex2(0.25 * time, 0.123);
        theta += ((env.mouse.pos[0] / env.el.width) - 0.5);
        cam_dir[2] = -Math.cos(theta);
        cam_dir[0] = Math.sin(theta);

        //if (!cam) {
            camera.update(cam_pos, cam_dir);
        //}

        time -= 0.005;
    }

    return {
        draw: draw,
        update: update
    };

}
