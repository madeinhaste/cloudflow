var USE_TEXLOD_FIX = false;

function cloudflow_main(canvas) {

    var canvas = new Canvas3D({
        el: canvas,
        antialias: true,
        extensions: [
            'OES_element_index_uint',
            'OES_texture_half_float',
            'OES_texture_half_float_linear',
            'OES_texture_float',
            'OES_texture_float_linear',
            'OES_standard_derivatives',
            'WEBGL_compressed_texture_s3tc',
            'EXT_shader_texture_lod',
        ],
        sources: [
            'shaders/default.glsl',
            'shaders/shoe.glsl',
            'shaders/shoe_pick.glsl',
            'shaders/tunnel.glsl',
        ]
    });

    var lerp = QWQ.lerp;
    var time = 0;

    canvas.show_grid = false;
    canvas.orbit.distance = 500;
    var target_orbit_distance = 25;
    canvas.camera.fov = 25;
    canvas.camera.far = 800;
    vec4.set(canvas.clear_color, 0, 0, 0, 0);
    vec3.set(canvas.orbit.rotate, 0, 0, 0);

    //$('#main').prepend(canvas.el);
    //key('g', function() { canvas.show_grid = !canvas.show_grid; });

    var params = {
        part: 0,
        color: [255, 255, 255],
        background: false,
        wire: false,
        gloss: 4.0,
        specular: 0.8,
        f0: 9,
        normal: 1,
    };

    var shoe = (function() {

        var shoe = {
            ob: null,
            mat: mat4.create(),
            draw: draw2,
            pick: pick,
            update: update,
            selected_part_id: -1,
            selected_part_index: -1,
            rumble: false
        };

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
            pgm.uniform1f('f0', 1/params.f0);
            pgm.uniform1f('specular', params.specular * 1.0);
            pgm.uniform1f('normal_mix', params.normal);
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

        function draw2(env) {
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
                s *= (1.0 - rumble_amount);

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
                var rad = 0.003 * time;
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

                    var s = lerp(0.5, 2.5 + 0.5*Math.sin(0.005*time), sel);
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

        function update(dt) {
            var delta = dt * 0.0015;
            shoe.selected_part_index = part_ids.indexOf(shoe.selected_part_id);
            //$('#debug').text(''+selected_part_index);

            for (var i = 0; i < 4; ++i) {
                if (i == shoe.selected_part_index)
                    part_select[i] = Math.min(1, part_select[i] + delta);
                else
                    part_select[i] = Math.max(0, part_select[i] - 3*delta);
            }
        }

        return shoe;

    }());

    var shoe_rot = vec2.create();
    var shoe_trans = vec3.create();

    var rumble = vec2.create();
    var rumble_start_time = 0;
    var rumble_amount = 0;

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

    var draw_funworld;

    function update_shoe(env) {
        var cw = env.el.width;
        var ch = env.el.height;

        var Q = 3;
        var rx = ((env.mouse.pos[1] / ch) - 0.5) * Q;
        var ry = ((env.mouse.pos[0] / cw) - 0.5) * Q;
        var k = 0.1;
        shoe_rot[0] = lerp(shoe_rot[0], rx, k);
        shoe_rot[1] = lerp(shoe_rot[1], ry, k);

        if (shoe.rumble) {
            rumble_amount = 1.0;
        } else {
            rumble_amount = Math.max(0.0, rumble_amount - 0.015);
        }

        draw_funworld = false;

        //var t = 0.01 * time;
        if (rumble_amount > 0.0) {
            var t = (time - rumble_start_time)/1000;
            var duration = 2.0;
            var post_duration = 0.35;

            if (t > duration + post_duration) {
                draw_funworld = true;
            } else if (t > duration) {
                var u = t - duration;

                shoe_trans[2] += 10.5 * u;
                shoe_trans[1] += 0.9 * u;
                shoe_trans[0] -= 2.0 * u;

                rumble[0] += 0.35;
                rumble[1] += 0.12;
            } else {
                var u = Math.min(1, t/duration);
                u = Math.pow(u, 0.25);

                var freq = lerp(0, 7, u);
                var amp = u*u * QWQ.RAD_PER_DEG * 25;
                var tt = freq * t;

                var A = Math.pow(rumble_amount, 2.0);

                amp *= A;

                rumble[0] = amp * fbm(tt, 0.1, 2);
                rumble[1] = amp * fbm(tt, 0.3, 2);

                var amp2 = u * QWQ.RAD_PER_DEG * 15;
                amp2 *= A;

                rumble[0] += amp2 * Math.cos(5 * t);
                rumble[1] += amp2 * Math.sin(5 * t);

                shoe_trans[1] = 1.5 * amp2 * fbm(0.5*tt, 0.4, 2);
            }

        }
        
        if (!shoe.rumble) {
            var damp = 0.98;
            rumble[0] *= damp;
            rumble[1] *= damp;
            vec3.scale(shoe_trans, shoe_trans, 0.50);
        }

        mat4.identity(shoe.mat);
        mat4.translate(shoe.mat, shoe.mat, shoe_trans);
        mat4.rotateX(shoe.mat, shoe.mat, rumble[0] - shoe_rot[0]);
        mat4.rotateY(shoe.mat, shoe.mat, rumble[1] - shoe_rot[1]);
    }

    var tunnel = new Tunnel;

    var experience_visible = false;
    function set_experience_visible(b) {
        if (b == experience_visible)
            return;

        experience_visible = b;
        api.on_experience(b);
    }

    var hover_part = -1;
    function set_hover_part() {
        var part = shoe.selected_part_index;
        if (part == hover_part)
            return;

        hover_part = shoe.selected_part_index;
        api.on_hover(hover_part);
    }


    canvas.draw = function() {
        if (!visible)
            return;

        //tunnel.update(this);
        //tunnel.draw(this);
        //return;

        if (1) {
            if (draw_funworld && shoe.rumble) {
                set_experience_visible(true);
                tunnel.update(this, this.camera);
                tunnel.draw(this);
            } else {
                set_experience_visible(false);
                api.on_rumble(vec2.length(rumble));
                update_shoe(this);
                shoe.draw(this);
            }
        }
    };

    canvas.pick = function() {
        if (!draw_funworld) {
            shoe.pick(this);
            set_hover_part();
        }
    };

    document.addEventListener('mousedown', function(e) {
        if (shoe.selected_part_id >= 0) {
            shoe.rumble = true;
            rumble_start_time = time;
        }
    }, false);

    document.addEventListener('mouseup', function(e) {
        if (!shoe.rumble)
            return;

        shoe.rumble = false;

        if (time - rumble_start_time > 2000) {
            canvas.orbit.distance = 500;
            vec2.set(shoe_rot, 0, 0);
            vec2.set(shoe_trans, 0, 0);
            vec2.set(canvas.orbit.rotate, 0, 0);
        }
    }, false);

    var last_time = 0;
    function animate(t) {
        time = t;
        var dt;
        if (!last_time) {
            last_time = t;
            dt = 0;
        } else {
            var dt = t - last_time;
            last_time = t;
        }

        if (1 && shoe.ob)
            canvas.orbit.distance = lerp(canvas.orbit.distance, target_orbit_distance, 0.003*dt);

        requestAnimationFrame(animate);

        if (1) {
            shoe.update(dt);
            var result = canvas._pick();
            if (result !== undefined) {
                var id = result;
                shoe.selected_part_id = id;
                //$('#debug').text(''+id);
            }
        }

        canvas._draw();
    }
    animate(0);

    0 && (function() {
        var gui = new dat.GUI();
        //gui.add(params, 'part', [0, 1, 2]);
        //gui.add(params, 'background');
        //gui.add(params, 'wire');
        gui.add(params, 'gloss', 0, 6);
        gui.add(params, 'specular', 0, 1);
        gui.add(params, 'f0', 1, 100);
        gui.add(params, 'normal', 0, 1);
    }());

    // load the geometry
    load_objects('data/cloudflow/cloudflow.msgpack').then(function(obs) {
        shoe.ob = obs.cloudflow;
    });

    var visible = true;

    var api = {
        set_visible: function(v) {
            visible = v;
        },

        reset: function() {
            canvas.orbit.distance = 500;
            //vec2.set(shoe_rot, Math.random() - 0.5, Math.random() - 0.5);
            //vec2.scale(shoe_rot, shoe_rot, 10.0);
        },

        on_hover: function(part) {},
        on_experience: function(b) {},
        on_rumble: function(v) {}
    };

    return api;
}
