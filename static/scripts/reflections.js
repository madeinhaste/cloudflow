function init_reflections() {
    var textures = {
        scape: null
    };

    var programs = {
        arc: webgl.get_program('arc'),
        simple: webgl.get_program('simple'),
        landscape: webgl.get_program('landscape')
    };

    var buffers = {
        verts: null,
        elems: null
    };

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

    var arcs = [];
    _.times(25, function() {
        arcs.push(vec4.fromValues(
                    3 * QWQ.lerp(-1, 1, Math.random()),
                    0.2,
                    QWQ.lerp(100, 1, Math.random()),
                    QWQ.lerp(0.5, 3, Math.random())));
    });

    function draw_arcs(env) {
        var camera = env.camera;
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

    function draw_scape(env) {
        var camera = env.camera;
        mat4.copy(mvp, camera.mvp);
        var pgm = programs.landscape.use();
        pgm.uniformMatrix4fv('mvp', mvp);
        pgm.uniform4f('color', 1.0, 1.0, 1.0, 1.0);
        pgm.uniformSampler2D('t_scape', textures.scape);
        pgm.uniform1f('time', time);
        pgm.uniform3fv('view_pos', camera.view_pos);

        webgl.bind_vertex_buffer(buffers.verts);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);
        gl.enable(gl.DEPTH_TEST);
        webgl.bind_element_buffer(buffers.elems);
        gl.drawElements(gl.TRIANGLES, n_elems, gl.UNSIGNED_INT, 0);
    }


    function draw(env) {
        draw_scape(env);
        draw_arcs(env);
    }
    
    var cam_pos = vec3.fromValues(0, 0.35, 10);
    var cam_dir = vec3.fromValues(0, 0, -1);

    function update(env) {
        var camera = env.camera;
        camera.fov = 80;
        camera.update(cam_pos, cam_dir);

        //var theta = Math.sin(time);
        var theta = noise.simplex2(0.25 * time, 0.123);
        theta += ((env.mouse.pos[0] / env.el.width) - 0.5);

        cam_dir[2] = -Math.cos(theta);
        cam_dir[0] = Math.sin(theta);

        //console.log(vec3.str(camera.view_pos));

        time -= 0.005;
    }

    return {
        draw: draw,
        update: update
    };

}
