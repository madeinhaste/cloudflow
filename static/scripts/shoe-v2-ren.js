function cloudflow_init_shoe_v2_ren() {

    var obs = null;
    load_objects('data/cf_1017/cf_1017.msgpack').then(function(data) {
        obs = data;
    });

    function load_texture(filename, opts) {
        opts = _.defaults(opts, {flip: 1, mipmap: 1});
        return webgl.load_texture('data/cf_1017/textures/cf_' + filename, opts);
    }

    function load_envmap(name, filename) {
        webgl.load_texture_ktx('data/cf_1017/envmap/' + filename)
            .then(function(tex) {
                textures[name] = tex;
            });
    }

    var textures = {
        shoe_col: load_texture('shoe_col.jpg'),
        shoe_nor: load_texture('shoe_nor.jpg'),
        shoe_occ: load_texture('shoe_occ.jpg'),
        shoe_ids: load_texture('shoe_ids.png'),

        sole_col: load_texture('sole_col.jpg'),
        sole_nor: load_texture('sole_nor.jpg'),
        sole_occ: load_texture('sole_occ.jpg'),
        sole_ids: load_texture('sole_ids.png'),

        tongue_col: load_texture('tongue_col.jpg'),
        tongue_nor: load_texture('tongue_nor.jpg'),
        tongue_occ: load_texture('tongue_occ.jpg'),

        laces_col: load_texture('laces_col.jpg'),
        laces_nor: load_texture('laces_nor.jpg', {wrap: gl.REPEAT}),

        iem: null,
        pmrem: null,
        pmrem2: null
    };

    load_envmap('iem', 'cubes_iem.ktx');
    load_envmap('pmrem', 'cubes_pmrem.ktx');
    load_envmap('pmrem2', 'cubes_pmrem2.ktx');

    var part_ids = [
        0x0000ff,   // mesh
        0x00ffff,   // sole
        0x00ff00,   // enforcement
        0xffff00,   // midsole
    ];

    var programs = {
        simple: webgl.get_program('simple'),
        shoe: webgl.get_program('shoe2', {defines: {
            NORMAL_MAP: 1,
            AMBOCC_MAP: 1,
            HAVE_TEXLOD: 1
        }}),
        shoe_no_occ: webgl.get_program('shoe2', {defines: {
            NORMAL_MAP: 1,
            HAVE_TEXLOD: 1
        }}),
        shoe_no_nor: webgl.get_program('shoe2', {defines: {
            HAVE_TEXLOD: 1
        }}),
        shoe_pick: webgl.get_program('shoe_pick')
    };

    var mat_normal = mat3.create();
    var mvp = mat4.create();

    function setup_matrix(pgm, matrix) {
        mat3.normalFromMat4(mat_normal, matrix);
        pgm.uniformMatrix4fv('model_matrix', matrix);
        pgm.uniformMatrix3fv('normal_matrix', mat_normal);
    }

    function draw_ob(env, ob, obtex) {
        var pgm;
        if (!obtex.nor) {
            pgm = programs.shoe_no_nor;
        } else if (!obtex.occ) {
            pgm = programs.shoe_no_occ;
        } else {
            pgm = programs.shoe;
        }
        pgm.use();
        
        var camera = env.camera;

        pgm.uniformMatrix4fv('mvp', camera.mvp);
        pgm.uniform3fv('viewpos', camera.view_pos);
        pgm.uniformMatrix4fv('view', camera.view);
        setup_matrix(pgm, env.mat);

        pgm.uniformSamplerCube('t_iem', textures.iem);
        pgm.uniformSamplerCube('t_rem', textures.pmrem);

        pgm.uniformSampler2D('t_color', obtex.col);
        pgm.uniformSampler2D('t_normal', obtex.nor);

        if (obtex.occ)
            pgm.uniformSampler2D('t_occ', obtex.occ);

        pgm.uniform1f('lod', 5.0);
        pgm.uniform1f('f0', 0.05);
        pgm.uniform1f('specular', 0.2);
        pgm.uniform1f('normal_mix', 1.0);
        pgm.uniform1f('normal_scale', obtex.nor_scale ? obtex.nor_scale : 1.0);
        pgm.uniform1f('ambient', 1.0);

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
        gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);
    }

    function draw_normal(env) {
        draw_ob(env, obs.cf_upper, {
            col: textures.shoe_col,
            nor: textures.shoe_nor,
            occ: textures.shoe_occ
        });

        draw_ob(env, obs.cf_tongue, {
            col: textures.tongue_col,
            nor: textures.tongue_nor,
            occ: textures.tongue_occ
        });

        draw_ob(env, obs.cf_laces, {
            col: textures.laces_col,
            nor: textures.laces_nor,
            nor_scale: 50
        });

        draw_ob(env, obs.cf_sole_high, {
            col: textures.sole_col,
            nor: textures.sole_nor,
            occ: textures.sole_occ
        });

        // little parts
        draw_ob(env, obs.cf_ridges, {
            col: textures.sole_col,
            nor: textures.sole_nor,
        });

        draw_ob(env, obs.cf_rings, {
            col: textures.shoe_col,
            nor: textures.shoe_nor
        });

        if (1) {
            draw_ob(env, obs.cf_logo_back, { col: textures.shoe_col });
            draw_ob(env, obs.cf_logo_front, { col: textures.sole_col });
            draw_ob(env, obs.cf_logo_sole, { col: textures.sole_col });
        }
    }

    function draw_highlight(env) {
        // TODO
    }

    function draw(env) {
        if (!ready()) return;
        draw_normal(env);
        draw_highlight(env);
    }

    function pick_ob(pgm, ob, tex) {
        pgm.uniformSampler2D('t_color', tex);
        webgl.bind_vertex_buffer(ob.buffers.position);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);
        webgl.bind_vertex_buffer(ob.buffers.texcoord);
        pgm.vertexAttribPointer('texcoord', 2, gl.FLOAT, false, 0, 0);
        webgl.bind_element_buffer(ob.buffers.index);
        gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);
    }

    function pick(env) {
        if (!ready()) return;
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        var pgm = programs.shoe_pick.use();
        pgm.uniformMatrix4fv('mvp', env.camera.mvp);
        pgm.uniformMatrix4fv('model_matrix', env.mat);
        pick_ob(pgm, obs.cf_upper, textures.shoe_ids);
        pick_ob(pgm, obs.cf_sole_high, textures.sole_ids);
    }

    function ready() {
        return obs && textures.iem && textures.pmrem && textures.pmrem2;
    }

    return {
        draw: draw,
        pick: pick,
        get_index_from_picked_id: function(id) { return part_ids.indexOf(id) },
        ready: ready
    };

}
