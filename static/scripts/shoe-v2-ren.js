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
        shoe_highlight: webgl.get_program('shoe2', {defines: {
            NORMAL_MAP: 1,
            HIGHLIGHT: 1,
            HAVE_TEXLOD: 1
        }}),
        shoe_pick: webgl.get_program('shoe_pick')
    };

    var mat_normal = mat3.create();
    var mat_highlight = mat3.create();
    var mvp = mat4.create();

    function setup_matrix(pgm, matrix) {
        mat3.normalFromMat4(mat_normal, matrix);
        pgm.uniformMatrix4fv('model_matrix', matrix);
        pgm.uniformMatrix3fv('normal_matrix', mat_normal);
    }

    function draw_ob(env, ob, obtex) {
        var pgm;
        if (obtex.highlight) {
            pgm = programs.shoe_highlight;
        } else if (!obtex.nor) {
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
        pgm.uniformSamplerCube('t_rem', obtex.highlight ? textures.pmrem2 : textures.pmrem);

        pgm.uniformSampler2D('t_color', obtex.col);

        if (obtex.nor)
            pgm.uniformSampler2D('t_normal', obtex.nor);

        if (obtex.occ)
            pgm.uniformSampler2D('t_occ', obtex.occ);

        pgm.uniform1f('lod', 5.0);
        pgm.uniform1f('f0', 0.05);
        pgm.uniform1f('specular', 0.2);
        pgm.uniform1f('normal_mix', 1.0);
        pgm.uniform1f('normal_scale', obtex.nor_scale ? obtex.nor_scale : 1.0);
        pgm.uniform1f('ambient', 1.0);

        if (obtex.highlight) {
            if (obtex.highlight_index >= 0) {
                var c = part_ids[obtex.highlight_index];
                pgm.uniform3f('highlight_id', (c&255)/255, ((c>>8)&255)/255, ((c>>16)&255)/255);
            } else {
                pgm.uniform3f('highlight_id', 0, 0, 0);
            }
            pgm.uniformMatrix3fv('highlight_mat', mat_highlight);
            pgm.uniformSampler2D('t_id', obtex.ids);

            pgm.uniform1f('lod', 0.0);
            pgm.uniform1f('f0', 0.80);
            pgm.uniform1f('specular', 5.0);
            pgm.uniform1f('ambient', 1.0);
            pgm.uniform1f('normal_mix', 0.5);
            pgm.uniform1f('highlight_alpha', obtex.highlight_amount);
        }

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

    function update_highlight_matrix(time) {
        mat3.identity(mat_highlight);
        var rad = 0.0010 * time;
        var s = Math.sin(rad), c = Math.cos(rad);
        mat_highlight[0] = c;
        mat_highlight[2] = s;
        mat_highlight[5] = c;
        mat_highlight[7] = -s;
    }

    function draw_highlight_index(env, idx) {
        var amount = env.part_select[idx];
        if (amount < 0.01)
            return;

        amount = QWQ.clamp(amount, 0.0, 1.0);

        if (idx == 0 || idx == 2) {
            // mesh or enforcement
            draw_ob(env, obs.cf_upper, {
                col: textures.shoe_col,
                nor: textures.shoe_nor,
                occ: textures.shoe_occ,
                ids: textures.shoe_ids,
                highlight: true,
                highlight_index: idx,
                highlight_amount: amount,
            });

            if (idx == 2) {
                draw_ob(env, obs.cf_logo_back, {
                    col: textures.shoe_col,
                    nor: textures.shoe_nor,
                    occ: textures.shoe_occ,
                    ids: textures.shoe_col,
                    highlight: true,
                    highlight_index: -1,
                    highlight_amount: amount
                });
            }
        } else if (idx == 1 || idx == 3) {
            // sole or midsole
            draw_ob(env, obs.cf_sole_high, {
                col: textures.sole_col,
                nor: textures.sole_nor,
                occ: textures.sole_occ,
                ids: textures.sole_ids,
                highlight: true,
                highlight_index: idx,
                highlight_amount: amount
            });
        }

    }

    function draw_highlight(env) {
        var idx = env.selected_part_index;
        if (idx < 0) return;

        update_highlight_matrix(env.time);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        for (var i = 0; i < 4; ++i) {
            draw_highlight_index(env, i);
        }
        gl.disable(gl.BLEND);

        /*
        for (var i = 0; i < 4; ++i) {
            var sel = env.part_select[i];
            if (sel == 0.0) continue;
            var s = lerp(0.5, 2.5 + 0.5*Math.sin(0.005*env.time), sel);
            pgm.uniform1f('specular', s * params.specular);
            var c = part_ids[i];
            pgm.uniform3f('highlight_id', (c&255)/255, ((c>>8)&255)/255, ((c>>16)&255)/255);
            draw_part(ob, 0);
        }
        */
    }

    function draw(env) {
        if (!ready()) return;

        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, 1);
            draw_normal(env);
        gl.disable(gl.POLYGON_OFFSET_FILL);

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
