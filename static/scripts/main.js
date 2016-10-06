function main() {

    var canvas = new Canvas3D({
        antialias: true,
        extensions: [
            'OES_element_index_uint',
            'OES_texture_half_float',
            'OES_texture_half_float_linear',
            'WEBGL_compressed_texture_s3tc',
            'EXT_shader_texture_lod',
        ],
        sources: [
            'shaders/default.glsl',
            'shaders/shoe.glsl',
            'shaders/shoe_pick.glsl',
            'shaders/envmap.glsl',
            'shaders/cyc.glsl',
            'shaders/funworld.glsl',
        ]
    });

    var lerp = QWQ.lerp;
    var time = 0;

    canvas.show_grid = false;
    canvas.orbit.distance = 500;
    var target_orbit_distance = 35;
    canvas.camera.fov = 25;
    canvas.camera.far = 800;
    vec3.set(canvas.orbit.rotate, 0, 0, 0);
    //canvas.camera.fov = 80;

    //canvas.orbit.translate[1] = 2.5;

    $('#main').prepend(canvas.el);
    window.onresize = () => canvas.redraw();

    key('g', function() {
        canvas.show_grid = !canvas.show_grid;
    });

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

    var envmap = (function() {

        return null;

        var ob = null;
        load_objects('data/sphere.msgpack').then(obs => {
            ob = obs.Icosphere;
        });

        var envmap = {
            texture: null,
            draw: draw
        };

        webgl.load_texture_ktx('data/nike/nike_ENVMAP_skybox.ktx').then(tex => {
            envmap.texture = tex;
        });

        var programs = {
            envmap: webgl.get_program('envmap'),
        };

        var mat = mat4.create();
        var mvp = mat4.create();

        function draw(env) {
            if (!ob) return;
            if (!envmap.texture) return;

            mat4.copy(mvp, env.camera.view);
            mvp[12] = mvp[13] = mvp[14] = 0;

            mat4.multiply(mvp, env.camera.proj, mvp);

            var pgm = programs.envmap.use();
            pgm.uniformMatrix4fv('mvp', mvp);
            pgm.uniform4f('color', 0.5, 0.5, 0.5, 0.5);
            pgm.uniformSamplerCube('t_envmap', envmap.texture);

            webgl.bind_vertex_buffer(ob.buffers.position);
            pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

            webgl.bind_vertex_buffer(ob.buffers.normal);
            pgm.vertexAttribPointer('normal', 3, gl.FLOAT, false, 0, 0);

            webgl.bind_vertex_buffer(ob.buffers.texcoord);
            pgm.vertexAttribPointer('texcoord', 2, gl.FLOAT, false, 0, 0);

            webgl.bind_element_buffer(ob.buffers.index);

            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.FRONT);

            gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);
        }

        return envmap;

    }());

    
    var funworld = (function() {
        var ob = null;
        load_objects('data/sphere.msgpack').then(obs => {
            ob = obs.Icosphere;
        });

        var funworld = {
            draw: draw
        };

        var programs = {
            funworld: webgl.get_program('funworld'),
        };

        var mvp = mat4.create();

        function draw(env) {
            if (!ob) return;

            mat4.copy(mvp, env.camera.view);
            mvp[12] = mvp[13] = mvp[14] = 0;
            mat4.multiply(mvp, env.camera.proj, mvp);

            var pgm = programs.funworld.use();
            pgm.uniformMatrix4fv('mvp', mvp);
            webgl.bind_vertex_buffer(ob.buffers.position);
            pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);
            webgl.bind_element_buffer(ob.buffers.index);

            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.FRONT);
            gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);
        }

        return funworld;
    }());

    var cyc = (function() {

        var cyc = {
            ob: null,
            draw: draw
        };

        var programs = {
            cyc: webgl.get_program('cyc'),
        };

        var textures = {
            color: webgl.load_texture('data/nike/nike_CYC.jpg', {flip: 1, mipmap: 1}),
        };

        var mat = mat4.create();
        var mvp = mat4.create();

        function draw(env) {
            if (!cyc.ob) return;
            var ob = cyc.ob;

            var pgm = programs.cyc.use();
            pgm.uniformMatrix4fv('mvp', env.camera.mvp);
            pgm.uniformSampler2D('t_color', textures.color);

            webgl.bind_vertex_buffer(ob.buffers.position);
            pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

            webgl.bind_vertex_buffer(ob.buffers.texcoord);
            pgm.vertexAttribPointer('texcoord', 2, gl.FLOAT, false, 0, 0);

            webgl.bind_element_buffer(ob.buffers.index);

            gl.enable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);
            gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);
        }

        return cyc;

    }());

    var shoe = (function() {

        var shoe = {
            ob: null,
            mat: mat4.create(),
            draw: draw2,
            pick: pick,
            update: update,
            selected_part_index: -1,
            rumble: false
        };

        var programs = {
            shoe: webgl.get_program('shoe', {defines: { NORMAL_MAP:1, AMBOCC_MAP:1 }}),
            midsole: webgl.get_program('shoe'),
            pick: webgl.get_program('shoe_pick')
        };
        
        var part_index = 0;

        var textures = {
            iem: null,
            rem: null,
            rem2: null,
            color: webgl.load_texture('data/nike/nike_COLOR.jpg', {flip: 1, mipmap: 1}),
            occ: webgl.load_texture('data/nike/nike_AMBOCC.jpg', {flip: 1, mipmap: 1}),
            normal: webgl.load_texture('data/nike/nike_NORMAL.jpg', {flip: 1, mipmap: 1}),
            midsole: webgl.load_texture('data/nike/nike_MIDSOLE.jpg', {flip: 1, mipmap: 1})
        };

        webgl.load_texture_ktx('data/nike/nike_ENVMAP_iem.ktx').then(tex => { textures.iem = tex });
        webgl.load_texture_ktx('data/nike/nike_ENVMAP_pmrem.ktx').then(tex => { textures.rem = tex });
        webgl.load_texture_ktx('data/nike/nike_ENVMAP2_pmrem.ktx').then(tex => { textures.rem2 = tex });

        var mat = mat4.create();
        var mvp = mat4.create();
        var mat_normal = mat3.create();

        function setup_matrix(pgm, matrix) {
            mat3.normalFromMat4(mat_normal, matrix);
            pgm.uniformMatrix4fv('model_matrix', matrix);
            pgm.uniformMatrix3fv('normal_matrix', mat_normal);
        }

        var show_midsole = 0;
        var midsole_anim = 0;
        var selection_anim = 0;

        function setup_draw(opts) {
            var pgm = opts.midsole ? programs.midsole : programs.shoe;
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

            if (opts.midsole) {
                pgm.uniformSampler2D('t_color', textures.midsole);
            } else {
                pgm.uniformSampler2D('t_color', textures.color);
                pgm.uniformSampler2D('t_occ', textures.occ);
                pgm.uniformSampler2D('t_normal', textures.normal);
            }

            pgm.uniform1f('lod', params.gloss);
            pgm.uniform1f('f0', 1/params.f0);
            pgm.uniform1f('specular', params.specular * 1.0);
            pgm.uniform1f('normal_mix', params.normal);

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
        var part_delta = [1, -1, 1, 1, 0];
        var part_select = [0, 0, 0, 0, 0];

        var part_trans = vec3.create();
        var curve = easing.easeOutBounce;

        function draw_translated_part(pgm, ob, index, picking) {
            part_trans[1] = part_delta[index] * curve(midsole_anim);
            mat4.translate(mat_part, shoe.mat, part_trans);

            if (index == 4) {

                if (picking) {
                    // draw this big
                    var s = 1.5;
                    mat4.scale(mat_part, mat_part, [s, 1, s]);
                } else {
                    // for animation
                    var s = QWQ.clamp(midsole_anim * 2, 0, 1);
                    s = easing.easeInOutCubic(s);
                }
            }

            var sel = part_select[index];
            if (sel > 0) {
                pgm.uniformSamplerCube('t_rem', textures.rem2);
                var s = lerp(0.5, 2.5 + 0.5*Math.sin(0.005*time), sel);
                pgm.uniform1f('specular', s * params.specular);
                pgm.uniform1f('lod', 0.0);
                pgm.uniform1f('f0', 0.80);
            } else {
                pgm.uniformSamplerCube('t_rem', textures.rem);
                pgm.uniform1f('specular', 1.0 * params.specular);
                pgm.uniform1f('lod', params.gloss);
                pgm.uniform1f('f0', 1/params.f0);
            }

            /*
            if (shoe.selected_part_index >= 0) {
                if (index == shoe.selected_part_index) {
                } else {
                    pgm.uniformSamplerCube('t_rem', textures.rem);
                    pgm.uniform1f('specular', 1.0 * params.specular);
                    pgm.uniform1f('lod', params.gloss);
                    pgm.uniform1f('f0', 1/params.f0);
                }
            }
            */

            setup_matrix(pgm, mat_part);
            draw_part(shoe.ob, index);
        }

        key('space', function() {
            if (!show_midsole) {
                show_midsole = true;
                curve = easing.easeOutBounce;
            } else {
                show_midsole = false;
                curve = easing.easeInQuad;
            }
        });

        function draw2(env) {
            if (!shoe.ob) return;

            var pgm = setup_draw({
                camera: env.camera,
                matrix: shoe.mat,
                object: shoe.ob,
                midsole: false
            });

            for (var i = 0; i < 4; ++i) {
                draw_translated_part(pgm, shoe.ob, i);
            }

            if (midsole_anim > 0.1) {
                var pgm = setup_draw({
                    camera: env.camera,
                    matrix: shoe.mat,
                    object: shoe.ob,
                    midsole: true
                });

                draw_translated_part(pgm, shoe.ob, 4);
            }
        }

        function pick(env) {
            if (!shoe.ob) return;
            var ob = shoe.ob;

            var pgm = programs.pick.use();
            pgm.uniformMatrix4fv('mvp', env.camera.mvp);

            webgl.bind_vertex_buffer(ob.buffers.position);
            pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

            gl.enable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);
            webgl.bind_element_buffer(ob.buffers.index);

            for (var i = 0; i < 4; ++i) {
                pgm.uniform4f('color', i/255, 0, 0, 1);
                draw_translated_part(pgm, ob, i);
            }

            //if (midsole_anim > 0.1) {
            pgm.uniform4f('color', 4/255, 0, 0, 1);
            draw_translated_part(pgm, ob, 4, true);
            //}
        }

        var show_midsole_time = 0;

        function update(dt) {
            if (shoe.selected_part_index == 4) {
                if (!show_midsole) {
                    if (show_midsole_time == 0) {
                        // 1 sec delay
                        show_midsole_time = time + 500;
                    } else if (time >= show_midsole_time) {
                        // open sesame
                        show_midsole = true;
                        show_midsole_time = 0;
                        curve = easing.easeOutBounce;
                    }
                }
            //} else if (shoe.selected_part_index >= 0) {
            } else {
                if (show_midsole && midsole_anim == 1) {
                    if (show_midsole_time == 0) {
                        show_midsole_time = time + 1000;
                    } else if (time >= show_midsole_time) {
                        // open sesame
                        show_midsole = false;
                        show_midsole_time = 0;
                        curve = easing.easeInQuad;
                    }
                }
            }

            var delta = dt * 0.0015;
            if (show_midsole) {
                midsole_anim = Math.min(1, midsole_anim + delta);
            } else {
                midsole_anim = Math.max(0, midsole_anim - 2*delta);
            }

            for (var i = 0; i < 5; ++i) {
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

    canvas.draw = function() {
        //if (envmap) envmap.draw(this);

        var cw = this.el.width;
        var ch = this.el.height;

        var Q = 2;
        var rx = ((this.mouse.pos[1] / ch) - 0.5) * Q;
        var ry = ((this.mouse.pos[0] / cw) - 0.5) * Q;
        var k = 0.1;
        shoe_rot[0] = lerp(shoe_rot[0], rx, k);
        shoe_rot[1] = lerp(shoe_rot[1], ry, k);

        //var t = 0.01 * time;
        if (shoe.rumble) {
            var t = (time - rumble_start_time)/1000;

            if (t > 3.35) {
                funworld.draw(this);
                return;
            } else if (t > 3.0) {
                var u = t - 3.0;
                shoe_trans[2] += 10.5 * u;
                shoe_trans[1] += 0.9 * u;
                shoe_trans[0] -= 2.0 * u;

                rumble[0] += 0.35;
                rumble[1] += 0.12;
            } else {
                var u = Math.min(1, t/3);

                var freq = lerp(0, 7, u);
                var amp = u*u * QWQ.RAD_PER_DEG * 25;
                var tt = freq * t;

                rumble[0] = amp * fbm(tt, 0.1, 2);
                rumble[1] = amp * fbm(tt, 0.3, 2);

                var amp2 = u * QWQ.RAD_PER_DEG * 15;
                rumble[0] += amp2 * Math.cos(5 * t);
                rumble[1] += amp2 * Math.sin(5 * t);

                shoe_trans[1] = 5 * amp2 * fbm(0.5*tt, 0.4, 2);
            }

        } else {
            var damp = 0.1;
            rumble[0] *= damp;
            rumble[1] *= damp;
            vec3.scale(shoe_trans, shoe_trans, 0.9);
        }

        mat4.identity(shoe.mat);
        mat4.translate(shoe.mat, shoe.mat, shoe_trans);
        mat4.rotateX(shoe.mat, shoe.mat, rumble[0] - shoe_rot[0]);
        mat4.rotateY(shoe.mat, shoe.mat, rumble[1] - shoe_rot[1]);

        //vec3.set(canvas.orbit.rotate, -0.15*ry, -0.15*rx, 0);

        //if (params.background) envmap.draw(this);

        cyc.draw(this);
        shoe.draw(this);
    };

    canvas.pick = function() {
        // TODO
        shoe.pick(this);
    };

    document.addEventListener('mousedown', function(e) {
        shoe.rumble = true;
        rumble_start_time = time;
    }, false);

    document.addEventListener('mouseup', function(e) {
        shoe.rumble = false;

        if (time - rumble_start_time > 3000) {
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

        if (shoe.ob)
            canvas.orbit.distance = lerp(canvas.orbit.distance, target_orbit_distance, 0.003*dt);

        requestAnimationFrame(animate);
        shoe.update(dt);

        var result = canvas._pick();
        if (result !== undefined) {
            var id = result;
            shoe.selected_part_index = id;
            //$('#debug').text(''+id);
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
    load_objects('data/nike/nike.msgpack').then(obs => {
        shoe.ob = obs.SHOE_LO;
        cyc.ob = obs.CYC_LO;
    });
}

$(main);
