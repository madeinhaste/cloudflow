function cloudflow_init_shoe() {

    var params = {
        gloss: 4.0,
        specular: 0.8,
        f0: 1/9,
    };

    var lerp = QWQ.lerp;

    function fbm(x, y, n) {
        var w = 1;
        var s = 0.0;
        while (n-- > 0) {
            s += w * noise.perlin2(x, y);
            x *= 2.0;
            y *= 2.0;
            w *= 0.5;
        }
        return s;
    }

    var shoe = {
        ob: null,
        mat: mat4.create(),
        draw: draw,
        pick: pick,
        update: update,
        selected_part_id: -1,
        selected_part_index: -1,
        rumble: false,
        rumble_amount: 0,
        rumble_start_time: 0,

        rot: vec2.create(),
        trans: vec3.create(),
        rumble2: vec2.create()
    };

    load_objects('data/cloudflow/cloudflow.msgpack').then(function(obs) {
        shoe.ob = obs.cloudflow;
    });

    var programs = {
        shoe: webgl.get_program('shoe', {defines: {
            NORMAL_MAP: 1,
            HAVE_TEXLOD: USE_TEXLOD_FIX ? 0 : 1
        }}),

        shoe_highlight: webgl.get_program('shoe', {defines: {
            HIGHLIGHT: 1,
            HAVE_TEXLOD: USE_TEXLOD_FIX ? 0 : 1
        }}),

        pick: webgl.get_program('shoe_pick')
    };
    
    var part_index = 0;

    var textures = {
        iem: null,
        rem: null,
        rem2: null,

        shoe_color: webgl.load_texture('data/cloudflow/shoe_diffuse.jpg', {flip: 1, mipmap: 1}),
        shoe_normal: webgl.load_texture('data/cloudflow/shoe_normal.jpg', {flip: 1, mipmap: 1}),

        tongue_color: webgl.load_texture('data/cloudflow/tongue_diffuse.jpg', {flip: 1, mipmap: 1}),
        tongue_normal: webgl.load_texture('data/cloudflow/tongue_normal.jpg', {flip: 1, mipmap: 1}),

        shoe_id: webgl.load_texture('data/cloudflow/shoe_id.png', {flip: 1, filter: gl.NEAREST}),
        shoe_alpha: webgl.load_texture('data/cloudflow/shoe_alpha.png', {flip: 1})
    };

    webgl.load_texture_ktx('data/nike/nike_ENVMAP_iem.ktx').then(function(tex) { textures.iem = tex });
    webgl.load_texture_ktx('data/nike/nike_ENVMAP_pmrem.ktx').then(function(tex) { textures.rem = tex });
    webgl.load_texture_ktx('data/nike/nike_ENVMAP2_pmrem.ktx').then(function(tex) { textures.rem2 = tex });

    var mat = mat4.create();
    var mvp = mat4.create();
    var mat_normal = mat3.create();

    function setup_matrix(pgm, matrix) {
        mat3.normalFromMat4(mat_normal, matrix);
        pgm.uniformMatrix4fv('model_matrix', matrix);
        pgm.uniformMatrix3fv('normal_matrix', mat_normal);
    }

    var selection_anim = 0;

    function setup_draw(opts) {
        var pgm = opts.highlight ? programs.shoe_highlight : programs.shoe;
        pgm.use();

        var camera = opts.camera;
        var ob = opts.object;

        pgm.uniformMatrix4fv('mvp', camera.mvp);
        pgm.uniform3fv('viewpos', camera.view_pos);

        if (opts.matrix)
            setup_matrix(pgm, opts.matrix);

        pgm.uniformMatrix4fv('view', camera.view);
        pgm.uniformSamplerCube('t_iem', textures.iem);
        pgm.uniformSamplerCube('t_rem', textures.rem);

        //pgm.uniformSampler2D('t_occ', textures.occ);
        pgm.uniformSampler2D('t_color', textures.shoe_color);
        pgm.uniformSampler2D('t_normal', textures.shoe_normal);

        if (opts.highlight) {
            pgm.uniformSampler2D('t_id', textures.shoe_id);
            pgm.uniformSampler2D('t_alpha', textures.shoe_alpha);
        }

        pgm.uniform1f('lod', params.gloss);
        pgm.uniform1f('f0', params.f0);
        pgm.uniform1f('specular', params.specular);
        pgm.uniform1f('normal_mix', 1.0);
        pgm.uniform1f('ambient', 2.0);

        webgl.bind_vertex_buffer(ob.buffers.position);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_vertex_buffer(ob.buffers.normal);
        pgm.vertexAttribPointer('normal', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_vertex_buffer(ob.buffers.tangent);
        pgm.vertexAttribPointer('tangent', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_vertex_buffer(ob.buffers.texcoord);
        pgm.vertexAttribPointer('texcoord', 2, gl.FLOAT, false, 0, 0);

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        webgl.bind_element_buffer(ob.buffers.index);
        return pgm;
    }

    function draw_part(ob, index) {
        var part = ob.parts[index];
        start = part.start << 2;
        count = part.count;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, start);
    }

    // 0: shoe
    // 1: sole
    // 2: mesh
    // 3: enforcement
    // 4: midsole

    var mat_part = mat4.create();
    var part_select = [0, 0, 0, 0];

    var part_ids = [
        0xffff00,   // mesh
        0x00ff00,   // sole
        0xff00ff,   // enforcement
        0x0000ff,   // midsole
    ];

    var highlight_rot = mat3.create();

    function draw(env) {
        if (!shoe.ob) return;

        if (!textures.iem) return;
        if (!textures.rem) return;
        if (!textures.rem2) return;

        if (1) {
            var pgm = setup_draw({
                camera: env.camera,
                matrix: shoe.mat,
                object: shoe.ob,
                highlight: false
            });

            var s = Math.max(part_select[0], part_select[1], part_select[2], part_select[3]);
            s = Math.min(1.0, s * 2.0);
            s *= (1.0 - shoe.rumble_amount);

            var ambient = lerp(2.0, 0.5, Math.pow(s, 0.5));
            pgm.uniform1f('ambient', ambient);

            var specular = lerp(params.specular, 0.5, s);
            pgm.uniform1f('specular', specular);

            gl.enable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(1, 1);

            pgm.uniformSampler2D('t_color', textures.shoe_color);
            pgm.uniformSampler2D('t_normal', textures.shoe_normal);

            draw_part(shoe.ob, 0);

            pgm.uniformSampler2D('t_color', textures.tongue_color);
            pgm.uniformSampler2D('t_normal', textures.tongue_normal);
            draw_part(shoe.ob, 1);

            gl.disable(gl.POLYGON_OFFSET_FILL);
        }

        // HIGHLIGHT
        if (shoe.selected_part_index >= 0) {
            var pgm = setup_draw({
                camera: env.camera,
                matrix: shoe.mat,
                object: shoe.ob,
                highlight: true
            });

            mat3.identity(highlight_rot);
            var rad = 0.003 * env.time;
            var s = Math.sin(rad), c = Math.cos(rad);
            highlight_rot[0] = c;
            highlight_rot[2] = s;
            highlight_rot[5] = c;
            highlight_rot[7] = -s;

            pgm.uniformSampler2D('t_color', textures.shoe_color);
            pgm.uniformSampler2D('t_normal', textures.shoe_normal);
            pgm.uniformMatrix3fv('highlight_rot', highlight_rot);

            pgm.uniformSamplerCube('t_rem', textures.rem2);
            pgm.uniform1f('lod', 0.0);
            pgm.uniform1f('f0', 0.80);
            pgm.uniform1f('ambient', 2.0);

            setup_matrix(pgm, shoe.mat);

            for (var i = 0; i < 4; ++i) {
                var sel = part_select[i];
                if (sel == 0.0) continue;

                var s = lerp(0.5, 2.5 + 0.5*Math.sin(0.005*env.time), sel);
                pgm.uniform1f('specular', s * params.specular);
                var c = part_ids[i];
                pgm.uniform3f('highlight_id', (c&255)/255, ((c>>8)&255)/255, ((c>>16)&255)/255);
                draw_part(shoe.ob, 0);
            }
        }
    }

    function pick(env) {
        if (!shoe.ob) return;
        var ob = shoe.ob;

        var pgm = programs.pick.use();
        pgm.uniformMatrix4fv('mvp', env.camera.mvp);

        webgl.bind_vertex_buffer(ob.buffers.position);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_vertex_buffer(ob.buffers.texcoord);
        pgm.vertexAttribPointer('texcoord', 2, gl.FLOAT, false, 0, 0);

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        webgl.bind_element_buffer(ob.buffers.index);

        pgm.uniformSampler2D('t_color', textures.shoe_id);

        setup_matrix(pgm, shoe.mat);
        draw_part(shoe.ob, 0);
    }

    function update_part_selection(dt) {
        var delta = dt * 0.0015;
        shoe.selected_part_index = part_ids.indexOf(shoe.selected_part_id);

        for (var i = 0; i < 4; ++i) {
            if (i == shoe.selected_part_index)
                part_select[i] = Math.min(1, part_select[i] + delta);
            else
                part_select[i] = Math.max(0, part_select[i] - 3*delta);
        }
    }

    function update_shoe(env) {
        var cw = env.el.width;
        var ch = env.el.height;

        var Q = 3;
        var rx = ((env.mouse.pos[1] / ch) - 0.5) * Q;
        var ry = ((env.mouse.pos[0] / cw) - 0.5) * Q;
        var k = 0.1;
        shoe.rot[0] = lerp(shoe.rot[0], rx, k);
        shoe.rot[1] = lerp(shoe.rot[1], ry, k);

        if (shoe.rumble) {
            shoe.rumble_amount = 1.0;
        } else {
            shoe.rumble_amount = Math.max(0.0, shoe.rumble_amount - 0.015);
        }

        env.draw_funworld = false;

        if (shoe.rumble_amount > 0.0) {
            var t = (env.time - shoe.rumble_start_time)/1000;
            var duration = 2.0;
            var post_duration = 0.35;

            if (t > duration + post_duration) {
                env.draw_funworld = true;
            } else if (t > duration) {
                var u = t - duration;

                shoe.trans[2] += 10.5 * u;
                shoe.trans[1] += 0.9 * u;
                shoe.trans[0] -= 2.0 * u;

                shoe.rumble2[0] += 0.35;
                shoe.rumble2[1] += 0.12;
            } else {
                var u = Math.min(1, t/duration);
                u = Math.pow(u, 0.25);

                var freq = lerp(0, 7, u);
                var amp = u*u * QWQ.RAD_PER_DEG * 25;
                var tt = freq * t;

                var A = Math.pow(shoe.rumble_amount, 2.0);

                amp *= A;

                shoe.rumble2[0] = amp * fbm(tt, 0.1, 2);
                shoe.rumble2[1] = amp * fbm(tt, 0.3, 2);

                var amp2 = u * QWQ.RAD_PER_DEG * 15;
                amp2 *= A;

                shoe.rumble2[0] += amp2 * Math.cos(5 * t);
                shoe.rumble2[1] += amp2 * Math.sin(5 * t);

                shoe.trans[1] = 1.5 * amp2 * fbm(0.5*tt, 0.4, 2);
            }

        }
        
        if (!shoe.rumble) {
            var damp = 0.98;
            shoe.rumble2[0] *= damp;
            shoe.rumble2[1] *= damp;
            vec3.scale(shoe.trans, shoe.trans, 0.50);
        }

        mat4.identity(shoe.mat);
        mat4.translate(shoe.mat, shoe.mat, shoe.trans);
        mat4.rotateX(shoe.mat, shoe.mat, shoe.rumble2[0] - shoe.rot[0]);
        mat4.rotateY(shoe.mat, shoe.mat, shoe.rumble2[1] - shoe.rot[1]);
    }


    function update(env, dt) {
        update_part_selection(dt);
        update_shoe(env);
    }

    return shoe;

}
