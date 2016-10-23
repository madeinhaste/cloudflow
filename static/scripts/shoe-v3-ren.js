// decode spherical to xyz
function decode_vec(out, enc_x, enc_y) {
    var angle_x = 2 * (enc_x / 65535) - 1;
    var angle_y = 2 * (enc_y / 65535) - 1;

    var theta_x = Math.sin(Math.PI * angle_x);
    var theta_y = Math.cos(Math.PI * angle_x);

    var phi_x = Math.sqrt(1.0 - angle_y * angle_y);
    var phi_y = ang_y;

    out[0] = theta_y * phi_x;
    out[1] = theta_x * phi_x;
    out[2] = phi_y;
}

function decompress_object(ob) {
    var bbox = ob.bbox;
    var vert_count = ob.position.length/3;

    // todo... maybe interleave?
    var out_pos = new Float32Array(3 * vert_count);
    var out_nor = new Float32Array(3 * vert_count);
    var out_tan = new Float32Array(3 * vert_count);
    var out_tex = new Float32Array(2 * vert_count);

    var src_pos = ob.position;
    var src_nor = ob.normal;
    var src_tan = ob.tangent;
    var src_tex = ob.texcoord;

    var tmp = vec3.create();

    var sp = 0;
    var dp = 0;
    for (var i = 0; i < vert_count; ++i) {
        var x = src_pos[sp + 0];
        var y = src_pos[sp + 1];
        var z = src_pos[sp + 2];

        out_pos[sp + 0] = bbox[0] + (bbox[3] - bbox[0]) * (src_pos[sp + 0] / 65535);
        out_pos[sp + 1] = bbox[1] + (bbox[4] - bbox[1]) * (src_pos[sp + 1] / 65535);
        out_pos[sp + 2] = bbox[2] + (bbox[5] - bbox[2]) * (src_pos[sp + 2] / 65535);

        decode_vec(tmp, src_nor[dp + 0], src_nor[dp + 1]);
        out_nor[sp + 0] = tmp[0];
        out_nor[sp + 1] = tmp[1];
        out_nor[sp + 2] = tmp[2];

        decode_vec(tmp, src_tan[dp + 0], src_tan[dp + 1]);
        out_tan[sp + 0] = tmp[0];
        out_tan[sp + 1] = tmp[1];
        out_tan[sp + 2] = tmp[2];

        out_tex[dp + 0] = src_tex[dp + 0] / 65535;
        out_tex[dp + 1] = src_tex[dp + 1] / 65535;

        sp += 3;
        dp += 2;
    }

    return {
        name: ob.name,
        data: {
            position: out_pos,
            normal: out_nor,
            tangent: out_tan,
            texcoord: out_tex,
            index: ob.index,
            edge_index: ob.edge_index
        }
    };
}


function cloudflow_init_shoe_v3_ren() {

    /*
    load_objects('data/cf_1022/cf_1022.msgpack').then(function(data) {
        obs = data;
        export_objects(obs, 'cf_1022_s0_ready.msgpack');
    });
    return;
    */

    var obs = null;
    fetch('data/models/rzo/cf_1022_s0_ready.msgpack.br')
    //fetch('data/test.msgpack.br')
        .then(function(res) { return res.arrayBuffer() })
        .then(function(br) { return brotli_decompress2(br) })
        .then(function(data) {
            data = msgpack.decode(new Uint8Array(data));

            obs = {};
            _.each(data, function(ob) {
                //ob = decompress_object(ob);

                var name = ob.name;
                console.log('ob:', name, ob.data.index.length/3);

                var buffers = {
                    position: webgl.new_vertex_buffer(ob.data.position),
                    normal: webgl.new_vertex_buffer(ob.data.normal),
                    tangent: webgl.new_vertex_buffer(ob.data.tangent),
                    texcoord: webgl.new_vertex_buffer(ob.data.texcoord),
                    index: webgl.new_element_buffer(ob.data.index),
                    edge_index: webgl.new_element_buffer(ob.data.edge_index)
                };
                obs[name] = {
                    name: name,
                    buffers: buffers,
                    index_count: ob.data.index.length
                };
            });
        });

    function export_objects(obs, filename) {
        var data = {};
        _.each(obs, function(ob) {
            data[ob.name] = {
                name: ob.name,
                data: ob.arrays
            };
            console.log('export:', ob.name);
        });

        var msg = msgpack.encode(data);
        fetch(`/save/${filename}`, {method: 'POST', body: msg});
    }

    function load_texture(name, opts) {
        var ext;
        if (webgl.extensions.WEBKIT_WEBGL_compressed_texture_pvrtc)
            ext = '.pvr.ktx.br';
        else if (webgl.extensions.WEBGL_compressed_texture_s3tc)
            ext = '.s3.ktx.br';

        var filename = name + ext;
        var url_base = 'data/textures/rzo/cf_1022/';
        var texture = webgl.load_texture_ktx(gl.TEXTURE_2D, url_base + filename);

        if (opts && opts.wrap) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrap);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrap);
        }

        return texture;
    }

    function load_envmap(name) {
        var ext = '.ktx.br';
        var filename = name + ext;
        var url_base = 'data/textures/rzo/envmaps/';
        return webgl.load_texture_ktx(gl.TEXTURE_CUBE_MAP, url_base + filename);
    }

    var textures = {
        shoe_col: load_texture('col_occ_shoe'),
        shoe_nor: load_texture('nor_ids_shoe'),
        sole_col: load_texture('col_occ_sole'),
        sole_nor: load_texture('nor_ids_sole'),
        tongue_col: load_texture('col_occ_tongue'),
        tongue_nor: load_texture('nor_tongue'),
        laces_col: load_texture('col_lace'),
        laces_nor: load_texture('nor_lace', {wrap: gl.REPEAT}),

        iem: load_envmap('cubes_iem'),
        pmrem: load_envmap('cubes_pmrem'),

        shoe_col_r: load_texture('col_occ_shoe_r'),
        sole_col_r: load_texture('col_occ_sole_r'),
        tongue_col_r: load_texture('col_occ_tongue_r'),
        laces_col_r: load_texture('col_lace_r'),
    };

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
            //AMBOCC_MAP: 1,
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
        shoe_pick: webgl.get_program('shoe_pick2'),
        cube: webgl.get_program('cube'),
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
        setup_matrix(pgm, env.mat);

        pgm.uniform1f('time', env.time/200000);

        pgm.uniformSamplerCube('t_iem', textures.iem);
        pgm.uniformSamplerCube('t_rem', textures.pmrem);

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
        pgm.uniform1i('use_normal2', env.use_normal2);
        pgm.uniform1f('ambient', 1.0);
        pgm.uniform1f('occlusion', obtex.occ || 0);

        if (obtex.shiny) {
            // for the rings
            pgm.uniform1f('lod', 5.0);
            pgm.uniform1f('f0', 0.90);
            pgm.uniform1f('specular', 0.5);
        }

        var id0 = obtex.id0 || 0;
        var id1 = obtex.id1 || 0;
        var id2 = obtex.id2 || 0;
        pgm.uniform3f('id_blend', id0, id1, id2);

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

    function Cube() {
        this.pos = vec3.fromValues(0, 0, -20),
        this.rot = quat.create(),
        this.spin = quat.create();
        this.mat = mat4.create(),
        this.scale = 15;
        this.randomize_rotation();
    }

    Cube.prototype.randomize_rotation = function() {
        QWQ.random.unit_vec3(this.rot);
        this.rot[3] = Math.random();
        quat.normalize(this.rot, this.rot);
    };

    Cube.prototype.update = function(dt) {
        quat.multiply(this.rot, this.rot, this.spin);
        quat.normalize(this.rot, this.rot);
        mat4.fromRotationTranslation(this.mat, this.rot, this.pos);
    };

    Cube.prototype.set_spin = function(rx, ry) {
        var q = 0.050;
        quat.identity(this.spin);
        quat.rotateX(this.spin, this.spin, q * rx);
        quat.rotateY(this.spin, this.spin, q * ry);
    };

    var cubes = [ new Cube, new Cube ];

    vec3.set(cubes[0].pos, -10, 0, -20);
    vec3.set(cubes[1].pos,  10, 0, -20);

    cubes[0].set_spin(0.010, 0.003);
    cubes[1].set_spin(-0.007, 0.004);

    var cubes_camera = new webgl.Camera;
    cubes_camera.near = 0.1;
    cubes_camera.far = 100;
    var cubes_camera_pos = vec3.fromValues(0, 0, 7);
    var cubes_camera_dir = vec3.fromValues(0, 0, -1);

    function draw_cube(env) {
        var pgm = programs.cube.use();

        vec4.copy(cubes_camera.viewport, gl.getParameter(gl.VIEWPORT));
        cubes_camera.update(cubes_camera_pos, cubes_camera_dir);
        var camera = cubes_camera;
        //var camera = env.camera;
        var ob = obs.Cube;

        pgm.uniformMatrix4fv('mvp', camera.mvp);
        pgm.uniform3fv('viewpos', camera.view_pos);

        pgm.uniformSamplerCube('t_iem', textures.iem);
        pgm.uniformSamplerCube('t_rem', textures.pmrem);

        webgl.bind_vertex_buffer(ob.buffers.position);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_vertex_buffer(ob.buffers.normal);
        pgm.vertexAttribPointer('normal', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_element_buffer(ob.buffers.index);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        cubes.forEach(function(cube) {
            cube.update();
            setup_matrix(pgm, cube.mat);
            pgm.uniform1f('scale', cube.scale);
            gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);
        });

        gl.clear(gl.DEPTH_BUFFER_BIT);
    }
    
    function draw_shoe(env) {
        // when drawing upper & sole, need to set id vector
        var shoe_col = env.red ? textures.shoe_col_r : textures.shoe_col;
        var sole_col = env.red ? textures.sole_col_r : textures.sole_col;
        var tongue_col = env.red ? textures.tongue_col_r : textures.tongue_col;
        var laces_col = env.red ? textures.laces_col_r : textures.laces_col;


        1&&draw_ob(env, obs.cf_upper, {
            col: shoe_col,
            nor: textures.shoe_nor,
            occ: 1,

            id1: env.part_select[0],
            id2: env.part_select[2],
        });

        1&&draw_ob(env, obs.cf_sole, {
            col: sole_col,
            nor: textures.sole_nor,
            occ: 1,

            id1: env.part_select[3],
            id2: env.part_select[1],
        });

        1&&draw_ob(env, obs.cf_tongue, {
            col: tongue_col,
            nor: textures.tongue_nor,
            occ: 1
        });

        1&&draw_ob(env, obs.cf_laces, {
            col: laces_col,
            nor: textures.laces_nor,
            nor_scale: 50
        });

        // little parts
        if (1) {
            draw_ob(env, obs.cf_rings, {
                col: shoe_col,
                shiny: true
            });
            draw_ob(env, obs.cf_strips, {
                col: shoe_col,
                id0: env.part_select[2]
            });
            draw_ob(env, obs.cf_logo_back, {
                col: shoe_col,
                id0: env.part_select[2]
            });
            draw_ob(env, obs.cf_logo_front, { col: sole_col });
            draw_ob(env, obs.cf_logo_sole, { col: sole_col });
        }
    }

    var rt = new webgl.RenderTexture(128, 128, true);
    var fxaa = webgl.get_program('fxaa');
    var quad = webgl.new_vertex_buffer(new Float32Array([ 0, 0, 1, 0, 0, 1, 1, 1 ]));

    function draw(env) {
        if (!ready()) return;

        rt.resize(env.cw, env.ch);
        rt.render(function() {
            gl.clearColor(0.95, 0.95, 0.94, 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            draw_cube(env);
            draw_shoe(env);
        });

        if (1) {
            var pgm = fxaa.use();
            webgl.bind_vertex_buffer(quad);
            pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);
            pgm.uniformSampler2D('s_color', rt.texture);
            pgm.uniform1i('enable', env.enable_fxaa);
            pgm.uniform2f('resolution', env.cw, env.ch);

            //gl.enable(gl.BLEND);
            //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            //gl.disable(gl.BLEND);
        }

        else {
            pick(env);
        }
    }

    function pick_ob(pgm, ob, tex, col) {
        pgm.uniform3fv('color', col);
        pgm.uniformSampler2D('t_id', tex);

        webgl.bind_vertex_buffer(ob.buffers.position);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);
        webgl.bind_vertex_buffer(ob.buffers.texcoord);
        pgm.vertexAttribPointer('texcoord', 2, gl.FLOAT, false, 0, 0);

        webgl.bind_element_buffer(ob.buffers.index);
        gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);
    }

    var pick_colors = {
        red: vec3.fromValues(1, 0, 0),
        green: vec3.fromValues(0, 1, 0)
    };

    function pick(env) {
        if (!ready()) return;

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        var pgm = programs.shoe_pick.use();
        pgm.uniformMatrix4fv('mvp', env.camera.mvp);
        pgm.uniformMatrix4fv('model_matrix', env.mat);
        pick_ob(pgm, obs.cf_upper, textures.shoe_nor, pick_colors.red);
        pick_ob(pgm, obs.cf_sole, textures.sole_nor, pick_colors.green);
    }

    function ready() {
        return obs;
    }

    function to_hex(x) {
        //return ('00000000' + x.toString(8)).substr(-8);
        return x.toString(16);
    }

    return {
        draw: draw,
        pick: pick,
        get_index_from_picked_id: function(id) {
            // 0: MFL, 0x80
            // 1: ZGF: 0xff00
            // 2: ENF: 0xff
            // 3: SPD: 0x8000
            if (id < 0)
                return -1;

            var R = id & 0xff;
            var G = (id >> 8) & 0xff;

            var eps = 5;
            if (R) {
                if (Math.abs(R - 0xff) < eps)
                    return 2;
                else if (Math.abs(R - 0x80) < eps)
                    return 0;
            }

            if (G) {
                if (Math.abs(G - 0xff) < eps)
                    return 1;
                else if (Math.abs(G - 0x80) < eps)
                    return 3;
            }

            return -1;

            //$('#debug').text(to_hex(id));
            //return part_ids.indexOf(id)
        },
        ready: ready
    };

}
