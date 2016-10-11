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
                    //elems.push(B, A);
                    //elems.push(A, C);

                    elems.push(A, B, C);
                    elems.push(C, D, A);
                }
            }
        }

        verts = new Float32Array(verts);
        elems = new Uint32Array(elems);

        console.log(verts.length);
        console.log(elems.length);

        this.buffers = {
            verts: webgl.new_vertex_buffer(verts),
            elems: webgl.new_element_buffer(elems)
        };

        this.programs = {
            tunnel: webgl.get_program('tunnel')
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

        var P = this.P;
        var dp = 0;
        for (var i = 0; i < n_rows; ++i) {
            var u = i / (n_rows - 1);
            P[dp + 0] = 0;
            P[dp + 1] = 3*Math.sin(2*Math.PI * u);
            P[dp + 2] = lerp(-10, 10, u);
            P[dp + 3] = 0;
            dp += 4;
        }

        this.update();
    }

    Tunnel.prototype.draw = function(env) {
        var pgm = this.programs.tunnel.use();

        pgm.uniformMatrix4fv('mvp', env.camera.mvp);
        pgm.uniform4f('color', 1.0, 0.0, 0.0, 1.0);
        pgm.uniform1f('time', time/n_rows);
        pgm.uniformSampler2D('t_frames', this.tex);

        webgl.bind_vertex_buffer(this.buffers.verts);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

        webgl.bind_element_buffer(this.buffers.elems);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);
        gl.drawElements(gl.TRIANGLES, this.n_elems, gl.UNSIGNED_INT, 0);
        gl.cullFace(gl.BACK);
    };

    function lerp(a, b, x) {
        return (1-x)*a + x*b;
    }

    var T0 = vec3.create();
    var Q0 = quat.create();
    var T = vec3.create();
    var Q = quat.create();

    var tt = 0;





    var mvp = mat4.create();


    Tunnel.prototype.update = function(env) {
        var P = this.P;

        // make the curve
        var dp = 0;
        for (var i = 0; i < n_rows - 1; ++i) {
            P[dp + 0] = P[dp + 4];
            P[dp + 1] = P[dp + 5];
            //P[dp + 2] = P[dp + 6];
            //P[dp + 3] = P[dp + 7];
            dp += 4;
        }

        P[dp + 0] = 1*noise.simplex2(tt, 0.123);
        P[dp + 1] = 1*noise.simplex2(tt, 0.983);
        P[dp + 2] = 10;
        tt += 0.01;

        // make the quat frame
        var dp = 4 * n_rows;
        var sp = 0;
        for (var i = 0; i < n_rows; ++i) {
            if (i < n_rows - 1) {
                if (i !== 0) {
                    vec3.copy(T0, T);
                    quat.copy(Q0, Q);
                }

                // tangent for this segment
                T[0] = P[sp + 4] - P[sp + 0];
                T[1] = P[sp + 5] - P[sp + 1];
                T[2] = P[sp + 6] - P[sp + 2];
                vec3.normalize(T, T);

                sp += 4;

                if (i === 0) {
                    vec3.copy(T0, T);
                    quat.rotationTo(Q, [1,0,0], T);
                    quat.copy(Q0, Q);
                } else {
                    // compare to previous
                    var dot = vec3.dot(T0, T);
                    if (dot < 0.999999) {
                        vec3.cross(Q, T0, T);
                        Q[3] = 1 + dot;
                        quat.normalize(Q, Q);
                        quat.multiply(Q, Q, Q0);
                        if (quat.dot(Q0, Q) < 0)
                            quat.scale(Q, Q, -1);
                    }
                }
            }

            P[dp + 0] = Q[0];
            P[dp + 1] = Q[1];
            P[dp + 2] = Q[2];
            P[dp + 3] = Q[3];
            dp += 4;
        }

        // update texture
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n_rows, 2, gl.RGBA, gl.FLOAT, P);

        if (env) {
            T[0] = P[0];
            T[1] = P[1];
            T[2] = P[2] - 0;

            var n = 10;
            Q[0] = P[4*n + 0];
            Q[1] = P[4*n + 1];
            Q[2] = P[4*n + 2];
            vec3.sub(Q, Q, T);

            env.camera.update(T, Q);
        }

        time += 1;
    };

    return Tunnel;

}());
