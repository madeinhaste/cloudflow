function init_meshflow() {
    function fract(x) {
        var xi = Math.floor(x);
        var xf = x - xi;
        return xf;
    }

    var lerp = QWQ.lerp;

    var textures = {
        //fabric: cloudflow_loader.texture('mfl.fabric', {wrap:gl.REPEAT, aniso:8})
        fabric: cloudflow_loader.texture('mfl.fabric', {wrap:gl.REPEAT, aniso:8})
    };

    var programs = {
        meshflow_mesh: webgl.get_program('meshflow'),
        meshflow_mesh: webgl.get_program('meshflow', {defines: { MESH: 1}}),
        meshflow_stripes: webgl.get_program('meshflow', {defines: { STRIPES: 1}}),
        meshflow_background: webgl.get_program('meshflow', {defines: { BACKGROUND: 1}})
    };

    var buffers = {
        verts: null,
        elems: null,
        quad: webgl.new_vertex_buffer(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]))
    };

    function hex_color(s) {
        if (s[0] == '#')
            s = s.substr(1);
        function parse_byte(idx) {
            var b = s.substr(2*idx, 2);
            return parseInt(b, 16)/255;
        }
        var r = parse_byte(0);
        var g = parse_byte(1);
        var b = parse_byte(2);
        return vec3.fromValues(r, g, b);
    }

    var colors = {
        mesh0: hex_color('29adeb'),
        mesh1: hex_color('0280be'),
        back0: hex_color('caf94b'),
        back1: hex_color('8ab609'),
    };

    var n_verts = 0;
    var n_elems = 0;
    var grid_size = 128;
    function make_grid() {
        var n = grid_size;
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

    var time = 0.0;
    var mvp = mat4.create();

    function draw_mesh_layer(env, idx) {
        var camera = env.camera;
        mat4.copy(mvp, camera.mvp);

        var pgm;
        if (idx == 0) {
            // yellow
            pgm = programs.meshflow_background.use();
            pgm.uniform3fv('color0', colors.back0);
            pgm.uniform3fv('color1', colors.back1);
            pgm.uniformSampler2D('t_fabric', textures.fabric);

        }
        else if (idx == 1) {
            // blue
            pgm = programs.meshflow_mesh.use();
            pgm.uniform3fv('color0', colors.mesh0);
            pgm.uniform3fv('color1', colors.mesh1);
            pgm.uniformSampler2D('t_fabric', textures.fabric);
        }
        else if (idx == 2) {
            // stripes
            pgm = programs.meshflow_stripes.use();
        }

        pgm.uniformMatrix4fv('mvp', mvp);
        pgm.uniform3f('translate', 0, (idx - 1), 0);
        pgm.uniform1f('time', time);
        pgm.uniform1f('drift', drift);

        webgl.bind_vertex_buffer(buffers.verts);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

        //gl.enable(gl.CULL_FACE);
        //gl.cullFace(gl.FRONT);

        gl.enable(gl.DEPTH_TEST);
        webgl.bind_element_buffer(buffers.elems);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawElements(gl.TRIANGLES, n_elems, gl.UNSIGNED_SHORT, 0);
        gl.disable(gl.BLEND);
    }


    function draw(env) {
        if (cam_pos[1] > 0) {
            draw_mesh_layer(env, 0);
            draw_mesh_layer(env, 1);
            draw_mesh_layer(env, 2);
        } else {
            draw_mesh_layer(env, 2);
            draw_mesh_layer(env, 0);
            draw_mesh_layer(env, 1);
        }
    }
    
    var cam_pos = vec3.fromValues(1, -0.95, 10);
    var cam_dir = vec3.fromValues(0, 0, -1);
    var cam_up = vec3.fromValues(0, 1, 0);
    var drift = 0.0;

    var bank = 0.1;
    var bank_amount = QWQ.RAD_PER_DEG * 1;
    var qbank = quat.create();

    function update(env) {
        time += 0.005;

        var camera = env.camera;
        if (1 && camera) {
            vec4.copy(camera.viewport, gl.getParameter(gl.VIEWPORT));
            camera.fov = 70;

            var h = (1 + env.mouse.pos_nd[1])/2;
            time += 0.005*h;

            h = lerp(-0.95, 2.0, h);
            cam_pos[1] = lerp(cam_pos[1], h, 0.1);

            var mx = env.mouse.pos_nd[0];
            drift += 0.003 * mx;

            bank = lerp(bank, mx * bank_amount, 0.1);

            quat.identity(qbank);
            quat.rotateZ(qbank, qbank, bank);
            vec3.set(cam_up, 0, 1, 0);
            vec3.transformQuat(cam_up, cam_up, qbank);

            camera.update(cam_pos, cam_dir, cam_up);
        }
    }

    return {
        draw: draw,
        update: update
    };

}