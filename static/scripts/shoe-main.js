var USE_TEXLOD_FIX = false;

function main() {

    var canvas = new Canvas3D({
        antialias: false,
        extensions: [
            'OES_element_index_uint',
            'OES_texture_half_float',
            'OES_texture_half_float_linear',
            'OES_texture_float',
            'OES_texture_float_linear',
            'OES_standard_derivatives',
            'WEBGL_compressed_texture_s3tc',
            'WEBKIT_WEBGL_compressed_texture_pvrtc',
            'EXT_shader_texture_lod',
            'ANGLE_instanced_arrays'
        ],
        sources: [
            'shaders/default.glsl',
            'shaders/shoe2.glsl',
            'shaders/shoe_pick2.glsl',
            'shaders/fxaa.glsl',
        ]
    });

    $('#main').prepend(canvas.el);

    //key('space', function() { aces = !aces });

    var shoe = (function() {

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
            }})
        };

        var mat = mat4.create();
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
            setup_matrix(pgm, mat);

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

        function draw(env) {
            if (!obs) return;
            if (!textures.iem) return;
            if (!textures.pmrem) return;

            1 && draw_ob(env, obs.cf_upper, {
                col: textures.shoe_col,
                nor: textures.shoe_nor,
                occ: textures.shoe_occ
            });

            1 && draw_ob(env, obs.cf_tongue, {
                col: textures.tongue_col,
                nor: textures.tongue_nor,
                occ: textures.tongue_occ
            });

            1 && draw_ob(env, obs.cf_laces, {
                col: textures.laces_col,
                nor: textures.laces_nor,
                nor_scale: 50
            });

            1 && draw_ob(env, obs.cf_sole_high, {
                col: textures.sole_col,
                nor: textures.sole_nor,
                occ: textures.sole_occ
            });

            // little parts

            1 && draw_ob(env, obs.cf_ridges, {
                col: textures.sole_col,
                nor: textures.sole_nor,
                //occ: textures.sole_occ,
            });

            1 && draw_ob(env, obs.cf_rings, {
                col: textures.shoe_col,
                nor: textures.shoe_nor
            });

            if (1) {
                draw_ob(env, obs.cf_logo_back, { col: textures.shoe_col });
                draw_ob(env, obs.cf_logo_front, { col: textures.sole_col });
                draw_ob(env, obs.cf_logo_sole, { col: textures.sole_col });
            }
        }

        return {
            draw: draw,
            mat: mat
        };

    }());

    var t0 = performance.now();
    var debug = $('#debug')[0];
    var elapsed_avg = 0;

    canvas.mouse_camera = false;

    canvas.draw = function() {
        if (canvas.mouse.button >= 0) {
            var Q = 0.01;
            var rx = Q * canvas.mouse.delta[0];
            var ry = Q * canvas.mouse.delta[1];
            mat4.invert(shoe.mat, shoe.mat);
            mat4.rotateY(shoe.mat, shoe.mat, -rx);
            mat4.rotateX(shoe.mat, shoe.mat, -ry);
            mat4.invert(shoe.mat, shoe.mat);
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        var t1 = performance.now();
        var elapsed = t1 - t0;
        elapsed_avg = QWQ.lerp(elapsed_avg, elapsed, 0.1);
        t0 = t1;

        debug.innerHTML = Math.round(1000/elapsed_avg);

        shoe.draw(this);
    };

    canvas.pick = function() {
    };

    function animate(t) {
        requestAnimationFrame(animate);
        canvas._draw();
    }
    animate(0);

}

$(main);
