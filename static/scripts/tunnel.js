var Tunnel = (function() {

    var n_cols = 128;
    var n_rows = 128;
    var time = 0.0;

    function Tunnel() {
        var verts = [];
        var elems = [];

        for (var row = 0; row < n_rows; ++row) {
            for (var col = 0; col < n_cols; ++col) {
                verts.push(col/(n_cols - 1), row/(n_rows - 1));
                if (col && row) {
                    var A = (row * n_cols) + col;
                    var B = A - 1;
                    var C = B - n_cols;
                    var D = C + 1;
                    //elems.push(A, B);
                    //elems.push(A, C);

                    elems.push(A, B, C);
                    elems.push(C, D, A);
                }
            }
        }

        verts = new Float32Array(verts);
        elems = new Uint32Array(elems);

        //console.log(verts.length);
        //console.log(elems.length);

        this.buffers = {
            verts: webgl.new_vertex_buffer(verts),
            elems: webgl.new_element_buffer(elems)
        };

        this.programs = {
            outer: webgl.get_program('tunnel'),
            inner: webgl.get_program('tunnel', {defines:{INNER:1}})
        };

        this.n_elems = elems.length;
        this.n_verts = verts.length / 2;


        this.P = new Float32Array(8 * n_rows);

        var tex = this.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n_rows, 2, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.update();
    }

    Tunnel.prototype.draw = function(env) {
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        if (1) {
            var pgm = this.programs.outer.use();
            pgm.uniformMatrix4fv('mvp', env.camera.mvp);
            pgm.uniform4f('color', 1.0, 0.0, 0.0, 1.0);
            pgm.uniform1f('time', time/n_rows);
            pgm.uniformSampler2D('t_frames', this.tex);
            pgm.uniform1f('radius', 2.0);

            webgl.bind_vertex_buffer(this.buffers.verts);
            pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

            webgl.bind_element_buffer(this.buffers.elems);

            gl.drawElements(gl.TRIANGLES, this.n_elems, gl.UNSIGNED_INT, 0);
        }
        
        if (1) {
            var pgm = this.programs.inner.use();
            pgm.uniformMatrix4fv('mvp', env.camera.mvp);
            pgm.uniform4f('color', 1.0, 0.0, 0.0, 1.0);
            pgm.uniform1f('time', time/n_rows);
            pgm.uniformSampler2D('t_frames', this.tex);
            pgm.uniform1f('radius', 1.0);

            var tt = 0.01 * time;
            var amp = 0.2 * noise.simplex2(tt, 0.624);
            //var freq = 30.0 * noise.simplex2(3*tt, 0.232);
            freq = 30.0;
            pgm.uniform2f('warp', amp, freq);

            webgl.bind_vertex_buffer(this.buffers.verts);
            pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

            webgl.bind_element_buffer(this.buffers.elems);

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
            gl.drawElements(gl.TRIANGLES, this.n_elems, gl.UNSIGNED_INT, 0);
            gl.depthMask(true);
            gl.disable(gl.BLEND);
        }
    };

    function lerp(a, b, x) {
        return (1-x)*a + x*b;
    }

    var T0 = vec3.create();
    var Q0 = quat.create();
    var T = vec3.create();
    var F = vec3.create();

    var Q = quat.create();
    var dQ = quat.create();

    var tt = 0;





    var mvp = mat4.create();


    Tunnel.prototype.update = function(env, camera) {
        var P = this.P;

        // "cursor"
        vec3.set(T, 0, 0, 0);

        // "advance"
        vec3.set(F, 0, 0, -20/(n_rows-1));

        // "rotate"
        var rx = 0;
        var ry = 0;
        var rz = 0;

        if (env) {
            var cw = window.innerWidth;
            var ch = window.innerHeight;
            var a = 0.05;
            rx += ((env.mouse.pos[1] / ch) - 0.5) * a;
            ry += ((env.mouse.pos[0] / cw) - 0.5) * a;
        }

        if (1) {
            var tt = 0.01 * time;
            var a = 0.0040;
            rx += a * noise.simplex2(tt, 0.123);
            ry += a * noise.simplex2(tt, 0.983);

            rz += 0.05 * noise.simplex2(0.5*tt, 0.348);
        }

        //rx = ry = rz = 0;

        //var rx = 0;
        //var ry = 0;
        //var rz = 0;

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
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n_rows, 2, gl.RGBA, gl.FLOAT, P);

        if (camera) {
            T[0] = P[0];
            T[1] = P[1];
            T[2] = P[2] - 0;

            var n = 10;
            Q[0] = P[4*n + 0];
            Q[1] = P[4*n + 1];
            Q[2] = P[4*n + 2];
            vec3.sub(Q, Q, T);

            camera.update(T, Q);
        }

        time += 1;
    };

    return Tunnel;

}());
