function cloudflow_init_shoe_v1_ren() {

    var params = {
        gloss: 4.0,
        specular: 0.8,
        f0: 1/9,
    };

    var lerp = QWQ.lerp;
    var ob = null;

    load_objects('data/cloudflow/cloudflow.msgpack').then(function(obs) {
        ob = obs.cloudflow;
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
    var highlight_rot = mat3.create();

    var part_ids = [
        0xffff00,   // mesh
        0x00ff00,   // sole
        0xff00ff,   // enforcement
        0x0000ff,   // midsole
    ];


    function setup_matrix(pgm, matrix) {
        mat3.normalFromMat4(mat_normal, matrix);
        pgm.uniformMatrix4fv('model_matrix', matrix);
        pgm.uniformMatrix3fv('normal_matrix', mat_normal);
    }

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

    function ready() {
        return (
            ob &&
            textures.iem &&
            textures.rem &&
            textures.rem2);
    }

    function draw(env) {
        if (!ready()) return;

        if (1) {
            var pgm = setup_draw({
                camera: env.camera,
                matrix: env.mat,
                object: ob,
                highlight: false
            });

            var s = Math.max(env.part_select[0], env.part_select[1], env.part_select[2], env.part_select[3]);
            s = Math.min(1.0, s * 2.0);
            s *= (1.0 - env.rumble_amount);

            var ambient = lerp(2.0, 0.5, Math.pow(s, 0.5));
            pgm.uniform1f('ambient', ambient);

            var specular = lerp(params.specular, 0.5, s);
            pgm.uniform1f('specular', specular);

            gl.enable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(1, 1);

            pgm.uniformSampler2D('t_color', textures.shoe_color);
            pgm.uniformSampler2D('t_normal', textures.shoe_normal);

            draw_part(ob, 0);

            pgm.uniformSampler2D('t_color', textures.tongue_color);
            pgm.uniformSampler2D('t_normal', textures.tongue_normal);
            draw_part(ob, 1);

            gl.disable(gl.POLYGON_OFFSET_FILL);
        }

        // HIGHLIGHT
        if (env.selected_part_index >= 0) {
            var pgm = setup_draw({
                camera: env.camera,
                matrix: env.mat,
                object: ob,
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

            setup_matrix(pgm, env.mat);

            for (var i = 0; i < 4; ++i) {
                var sel = env.part_select[i];
                if (sel == 0.0) continue;

                var s = lerp(0.5, 2.5 + 0.5*Math.sin(0.005*env.time), sel);
                pgm.uniform1f('specular', s * params.specular);
                var c = part_ids[i];
                pgm.uniform3f('highlight_id', (c&255)/255, ((c>>8)&255)/255, ((c>>16)&255)/255);
                draw_part(ob, 0);
            }
        }
    }

    function pick(env) {
        if (!ready()) return;

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

        setup_matrix(pgm, env.mat);
        draw_part(ob, 0);
    }


    return {
        draw: draw,
        pick: pick,
        get_index_from_picked_id: function(id) {
            return part_ids.indexOf(id);
        },
        ready: ready
    };

}
