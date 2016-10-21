function init_speedboard() {
    function fract(x) {
        var xi = Math.floor(x);
        var xf = x - xi;
        return xf;
    }

    var textures = {
        widget: webgl.load_texture('images/widget2_ao.jpg', {mipmap:1, flip:1})
    };

    var programs = {
        simple: webgl.get_program('simple'),
        groove: webgl.get_program('groove'),
        widget: webgl.get_program('widget'),
    };

    var buffers = {
        verts: null,
        elems: null
    };

    var ob = null;
    load_objects('data/widget2.msgpack').then(function(data) {
        ob = data.widget;
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

    var sc = 1;
    var rot0 = mat4.create();
    mat4.rotateY(rot0, rot0, 0.5*Math.PI);
    mat4.scale(rot0, rot0, [sc,sc,sc]);

    var rot1 = mat4.create();
    mat4.rotateY(rot1, rot1, -0.5*Math.PI);
    mat4.scale(rot1, rot1, [sc,sc,sc]);

    var ii = 0;
    function draw_widgets(env) {
        if (!ob) return;
        var pgm = programs.widget.use();
        var camera = env.camera;

        pgm.uniformMatrix4fv('mvp', camera.mvp);
        pgm.uniformSampler2D('t_color', textures.widget);
        //pgm.uniform1f('time', time);
        //pgm.uniform3fv('view_pos', camera.view_pos);

        webgl.bind_vertex_buffer(ob.buffers.position);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_vertex_buffer(ob.buffers.texcoord);
        pgm.vertexAttribPointer('texcoord', 2, gl.FLOAT, false, 0, 0);

        webgl.bind_element_buffer(ob.buffers.index);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);

        var tt = 15 * time;

        for (var i = 0; i < 10; ++i) {
            var ci = (i - Math.floor(tt)) % 5;
            if (ci < 1)
                pgm.uniform3f('color', 1, 1, 1);
            else
                pgm.uniform3f('color', 0.5, 1, 0.5);

            //var dz = fract(-9.0*time);
            //var z = 10 - 4 * (i - dz);
            //var y = 3.0 - 2.0 * (1.0 + Math.sin(1.0*time + 3.0*i/17));
            //++ii;

            var dz = fract(tt);


            var theta = Math.PI * ((i + tt)/4);
            var dx = 2.0 + 0.5*Math.sin(theta);
            var z = 9 - 2*(i + dz);

            pgm.uniform3f('translate', dx, 0, z);
            pgm.uniformMatrix4fv('model_matrix', rot0);
            gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);

            pgm.uniform3f('translate', -dx, 0, z);
            pgm.uniformMatrix4fv('model_matrix', rot1);
            gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);

            //pgm.uniform3f('translate', -2, y, z);
            //pgm.uniformMatrix4fv('model_matrix', rot1);
            //gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);
        }
        ii -=16;
    }

    function draw_scape(env) {
        var camera = env.camera;
        mat4.copy(mvp, camera.mvp);
        var pgm = programs.groove.use();
        pgm.uniformMatrix4fv('mvp', mvp);
        pgm.uniform4f('color', 0.9, 1.0, 0.3, 1.0);
        pgm.uniformSampler2D('t_scape', textures.scape);
        pgm.uniform1f('time', time);
        pgm.uniform3fv('view_pos', camera.view_pos);

        webgl.bind_vertex_buffer(buffers.verts);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

        gl.enable(gl.DEPTH_TEST);
        gl.cullFace(gl.BACK);
        webgl.bind_element_buffer(buffers.elems);
        gl.drawElements(gl.TRIANGLES, n_elems, gl.UNSIGNED_INT, 0);
    }


    function draw(env) {
        draw_scape(env);
        draw_widgets(env);
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

        time -= 0.005;
    }

    return {
        draw: draw,
        update: update
    };

}
