function init_speedboard() {
    function fract(x) {
        var xi = Math.floor(x);
        var xf = x - xi;
        return xf;
    }

    var lerp = QWQ.lerp;

    var textures = {
        //widget: webgl.load_texture('images/widget2_ao.jpg', {mipmap:1, flip:1})
        widget: webgl.load_texture('images/cloud_ao.jpg', {mipmap:1, flip:1})
    };

    var programs = {
        simple: webgl.get_program('simple'),
        groove: webgl.get_program('groove'),
        widget: webgl.get_program('widget'),
        background: webgl.get_program('spd_background'),
    };

    var buffers = {
        verts: null,
        elems: null,
        quad: webgl.new_vertex_buffer(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]))
    };

    var ob = null;
    load_objects('data/cloud.msgpack').then(function(data) {
        ob = data.cloud_s1;
    });

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
                var h = 6*Math.sin(Math.PI*u) * (0.01 + Math.pow(2*(u-0.5),2));
                var y = h * (1 + noise.simplex2(sc*u, sc*v));
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

    //var rot0 = mat3.create();
    //mat4.rotateY(rot0, rot0, 0.5*Math.PI);
    //var rot1 = mat3.create();
    //mat4.rotateY(rot1, rot1, -0.5*Math.PI);
    //
    var rot0 = quat.create();
    var rot1 = quat.create();

    var tmp = vec3.create();
    var qtmp = quat.create();

    function draw_widgets(env) {
        if (!ob) return;
        var pgm = programs.widget.use();
        var camera = env.camera;

        pgm.uniformMatrix4fv('mvp', camera.mvp);
        pgm.uniformSampler2D('t_color', textures.widget);
        pgm.uniform1f('scale', 16);

        webgl.bind_vertex_buffer(ob.buffers.position);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_vertex_buffer(ob.buffers.texcoord);
        pgm.vertexAttribPointer('texcoord', 2, gl.FLOAT, false, 0, 0);

        webgl.bind_element_buffer(ob.buffers.index);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        var tt = 15 * time;
        var C = curve.data;

        var time_mult = 128/8;

        var dt = fract(time_mult*time);
        var dz = 8*4*dt;

        var qstart = 4 * 256;

        for (var i = 0; i < 16; ++i) {
            var ii = 8 * i;

            var ci = (i + Math.floor(time_mult*time)) % 5;
            if (ci < 3)
                pgm.uniform3f('color', 1, 1, 1);
            else
                pgm.uniform3f('color', 0.5, 1, 0.5);

            vec3.set(tmp, 0.0, 0.0, 0);

            var sp2 = 8 * ii;
            var sp = 8 * (ii + 8);
            tmp[0] += lerp(C[sp + 0], C[sp2 + 0], dt);
            tmp[1] += lerp(C[sp + 1], C[sp2 + 1], dt);
            tmp[2] += lerp(C[sp + 2], C[sp2 + 2], dt);

            var sp2 = qstart + 8 * ii;
            var sp = qstart + 8 * (ii + 8);
            quat.identity(qtmp);
            qtmp[0] = lerp(C[sp + 0], C[sp2 + 0], dt);
            qtmp[1] = lerp(C[sp + 1], C[sp2 + 1], dt);
            qtmp[2] = lerp(C[sp + 2], C[sp2 + 2], dt);
            qtmp[3] = lerp(C[sp + 3], C[sp2 + 3], dt);
            quat.normalize(qtmp, tmp);

            var dx = 24;
            var dy = 16.0;
            pgm.uniform3f('translate', tmp[0] - dx, tmp[1] + dy, tmp[2]);
            quat.identity(rot0);
            //quat.rotateY(rot0, rot0, 0.5*Math.PI);
            quat.multiply(rot0, rot0, qtmp);
            pgm.uniform4fv('rotate', qtmp);
            gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);

            pgm.uniform3f('translate', tmp[0] + dx, tmp[1] + dy, tmp[2]);
            quat.identity(rot1);
            quat.rotateY(rot1, qtmp, Math.PI);
            pgm.uniform4fv('rotate', rot1);
            gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);
        }
    }

    function draw_scape(env) {
        var camera = env.camera;
        mat4.copy(mvp, camera.mvp);
        var pgm = programs.groove.use();
        pgm.uniformMatrix4fv('mvp', mvp);
        pgm.uniform4f('color', 0.9, 1.0, 0.3, 1.0);
        pgm.uniformSampler2D('t_curve', curve.tex);
        pgm.uniform1f('time', time);
        pgm.uniform3fv('view_pos', camera.view_pos);

        webgl.bind_vertex_buffer(buffers.verts);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);

        webgl.bind_element_buffer(buffers.elems);
        gl.drawElements(gl.TRIANGLES, n_elems-2048, gl.UNSIGNED_SHORT, 0);
    }


    function draw(env) {
        draw_background(env);
        draw_widgets(env);
        draw_scape(env);
    }
    
    var cam_pos = vec3.fromValues(0, 1.50, 12);
    var cam_dir = vec3.fromValues(0, 0, -1);

    function update(env) {
        //var camera = env.camera;
        //camera.fov = 50;
        //camera.update(cam_pos, cam_dir);

        //var theta = noise.simplex2(0.25 * time, 0.123);
        //theta += ((env.mouse.pos[0] / env.el.width) - 0.5);

        //cam_dir[2] = -Math.cos(theta);
        //cam_dir[0] = Math.sin(theta);

        time += 0.005;
        //time += 0.001;
        curve.update(env);
    }

    function draw_background() {
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        var pgm = programs.background.use();
        pgm.uniform3f('color1', 0.7, 0.9, 1.0);
        //pgm.uniform3f('color1', 0.3, 0.1, 0.8);
        pgm.uniform3f('color0', 1, 1, 1);
        webgl.bind_vertex_buffer(buffers.quad);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    var curve = (function() {

        var n_rows = 256;
        var curve = new Float32Array(8 * n_rows);

        var curve_tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, curve_tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n_rows, 2, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        var T0 = vec3.create();
        var Q0 = quat.create();
        var T = vec3.create();
        var F = vec3.create();

        var Q = quat.create();
        var dQ = quat.create();

        var tt = 0;

        function update_curve(env) {
            var P = curve;

            vec3.set(T, 0, 0, 0);
            vec3.set(F, 0, 0, -500/(n_rows-1));

            // "rotate"
            var rx = 0;
            var ry = 0;
            var rz = 0;

            if (0 && env) {
                var cw = env.el.width;
                var ch = env.el.height;
                var a = 0.03;
                rx += ((env.mouse.pos[1] / ch) - 0.5) * a;
                ry += ((env.mouse.pos[0] / cw) - 0.5) * a;
            }

            if (1) {
                //var tt = 0.05 * time;
                var tt = time;
                var a = 0.0040;
                //var a = 0.0100;
                rx += a * noise.simplex2(tt, 0.123);
                ry += a * noise.simplex2(tt, 0.983);
                //rz += 0.05 * noise.simplex2(0.5*tt, 0.348);

                //ry = 0.01;
                //kkkrx = 0.00;
            }

            // dQ is the incremental rotate
            quat.identity(dQ);
            quat.rotateX(dQ, dQ, rx);
            quat.rotateY(dQ, dQ, ry);
            quat.rotateZ(dQ, dQ, rz);

            // Q is the accumulated rotate
            quat.identity(Q);

            // make the curve
            var vp = 0;
            var qp = 4 * n_rows;
            for (var i = 0; i < n_rows; ++i) {
                var u = i / (n_rows - 1);
                P[vp + 0] = T[0];
                P[vp + 1] = T[1];
                P[vp + 2] = T[2];
                P[vp + 3] = 0;  // unused

                P[qp + 0] = Q[0];
                P[qp + 1] = Q[1];
                P[qp + 2] = Q[2];
                P[qp + 3] = Q[3];

                // advance cursor
                quat.multiply(Q, Q, dQ);
                quat.normalize(Q, Q);

                vec3.transformQuat(F, F, dQ);
                vec3.add(T, T, F);

                vp += 4;
                qp += 4;
            }

            // update texture
            gl.bindTexture(gl.TEXTURE_2D, curve_tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n_rows, 2, gl.RGBA, gl.FLOAT, P);

            var camera = env.camera;
            if (1 && camera) {
                vec4.copy(camera.viewport, gl.getParameter(gl.VIEWPORT));

                T[0] = P[0] + 1.8*noise.simplex2(3*time, 0.358);
                T[1] = P[1] + 1.0  + 1.0*noise.simplex2(5*time, 0.213);
                T[2] = P[2] - 0;

                var sp = 8 * 10;
                var k = 0.5;
                T[0] = lerp(T[0], P[sp + 0], k);
                T[1] = lerp(T[1], P[sp + 1], k);
                T[2] = lerp(T[2], P[sp + 2], k);

                var n = 10;
                Q[0] = P[4*n + 0];
                Q[1] = P[4*n + 1];
                Q[2] = P[4*n + 2];
                vec3.sub(Q, Q, T);

                quat.identity(Q);
                camera.update_quat(T, Q);
            }
        }

        return {
            update: update_curve,
            data: curve,
            tex: curve_tex,
        };

    }());

    return {
        draw: draw,
        update: update
    };

}
