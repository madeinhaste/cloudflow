function init_meshflow() {

    var palette = 'blue';

    var loops = [
        sounds.get('mfl/mfl-loop0', true),
        sounds.get('mfl/mfl-loop1', true),
        sounds.get('mfl/mfl-loop2', true),
    ];

    loops[0].volume(0).play();
    loops[1].volume(0).play();
    loops[2].volume(0).play();

    function fract(x) {
        var xi = Math.floor(x);
        var xf = x - xi;
        return xf;
    }

    var lerp = QWQ.lerp;

    var textures = {
        fabric: cloudflow_loader.texture('common.nrm_lum_knit2', {wrap:gl.REPEAT, aniso:8})
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
        var c = vec3.create();
        return QWQ.color.hex_to_rgb(c, s);
    }

    var palettes = {
        blue: {
            mesh0: hex_color('29adeb'),
            mesh1: hex_color('0280be'),
            back0: hex_color('caf94b'),
            back1: hex_color('8ab609'),
        },
        red: {
            mesh0: hex_color('e73541'),
            mesh1: hex_color('ac1921'),
            back0: hex_color('e67816'),
            back1: hex_color('9f5500'),
        }
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
    var light_pos = vec3.fromValues(3, 10, 5);

    function draw_mesh_layer(env, idx) {
        var colors = palettes[palette];

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
        pgm.uniform3fv('view_pos', env.camera.view_pos);
        pgm.uniform3fv('light_pos', light_pos);
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

    var loop_volume = [0, 0, 0];
    var camera = new webgl.Camera;
    camera.far = 1000;
    camera.near = 0.01;
    camera.fov = 70;

    function update(env) {
        //time += 0.0001;
        //mat4.copy(mvp, env.camera.mvp);
        //return;
        time += 0.005 * 0.80;

        if (camera) {
            var h = (1 + env.mouse.pos_nd[1])/2;
            h = QWQ.clamp(h, 0.0, 1.0);
            time += 0.005*h;

            h = lerp(-0.95, 4.0, h);
            cam_pos[1] = lerp(cam_pos[1], h, 0.1);
            //cam_pos[1] = 1.5;   // XXX

            var mx = env.mouse.pos_nd[0];
            drift += 0.003 * mx;

            bank = lerp(bank, mx * bank_amount, 0.1);

            quat.identity(qbank);
            quat.rotateZ(qbank, qbank, bank);
            vec3.set(cam_up, 0, 1, 0);
            vec3.transformQuat(cam_up, cam_up, qbank);

            vec4.copy(camera.viewport, gl.getParameter(gl.VIEWPORT));
            camera.update(cam_pos, cam_dir, cam_up);
            mat4.copy(mvp, camera.mvp);
        }

        for (var i = 0; i < 3; ++i) {
            var x = 0.0;
            var y = cam_pos[1];
            if (i == 0 && y < 0) x = 1.0;
            if (i == 1 && 0 <= y && y < 1) x = 1.0;
            if (i == 2 && 1 <= y) x = 1.0;

            var v = loop_volume[i];
            if (v !== x) {
                v = loop_volume[i] = lerp(v, x, 0.1);
                loops[i].volume(v);
            }
        }
    }

    return {
        draw: draw,
        update: update,
        enter: function(red) {
            loops.forEach(function(l) { l.volume(0).play() });
            palette = red ? 'red' : 'blue';
        },
        leave: function() {
            loops.forEach(function(l) { l.stop() });
        }
    };

}
