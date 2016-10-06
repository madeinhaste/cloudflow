function main() {

    var canvas = new Canvas3D({
        antialias: false,
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
            'shaders/envmap.glsl',
        ]
    });
    canvas.show_grid = true;
    canvas.orbit.distance = 15;
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
        gloss: 3.0,
        specular: 0.8,
        f0: 5,
        normal: 1,
        twist: 0
    };

    var envmap = (function() {

        var ob = null;
        load_objects('data/sphere.msgpack').then(obs => {
            ob = obs.Icosphere;
        });

        var envmap = {
            texture: null,
            draw: draw
        };

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


    var object = (function() {

        var ob = null;
        load_objects('data/cloudflow_01_40k.msgpack').then(obs => {
            ob = obs.cloudflow_01_40k;
        });

        var programs = {
            shoe: webgl.get_program('shoe'),
        };
        
        var part_index = 0;

        var textures = {
            iem: null,
            rem: null,
            color: webgl.load_texture('data/tex_Color2.png', {flip: 1, mipmap: 1}),
            //occ: webgl.load_texture('data/tex_occ.png', {flip: 1, mipmap: 1}),
            //normal: webgl.load_texture('data/tex_normal.png', {flip: 1, mipmap: 1})
            occ: webgl.load_texture('data/tex_AmbOcc.png', {flip: 1, mipmap: 1}),
            normal: webgl.load_texture('data/tex_Normal2.png', {flip: 1, mipmap: 1})
        };

        webgl.load_texture_ktx('data/iem.ktx').then(tex => {
            textures.iem = tex;
        });

        webgl.load_texture_ktx('data/rem.ktx').then(tex => {
            textures.rem = tex;
        });


        var mat = mat4.create();
        var mvp = mat4.create();

        function draw(env) {
            if (!ob) return;
            if (!textures.iem) return;

            mat4.copy(mvp, env.camera.mvp);

            var pgm = programs.shoe.use();
            pgm.uniformMatrix4fv('mvp', mvp);
            pgm.uniformMatrix4fv('view', env.camera.view);
            //pgm.uniform4f('color', 0.5, 0.5, 0.5, 0.5);
            pgm.uniform3f('color', params.color[0]/255, params.color[1]/255, params.color[2]/255);
            pgm.uniformSamplerCube('t_iem', textures.iem);
            pgm.uniformSamplerCube('t_rem', textures.rem);
            pgm.uniformSampler2D('t_color', textures.color);
            pgm.uniformSampler2D('t_occ', textures.occ);
            pgm.uniformSampler2D('t_normal', textures.normal);
            pgm.uniform1f('lod', params.gloss);
            pgm.uniform1f('f0', 1/params.f0);
            pgm.uniform1f('specular', params.specular);
            pgm.uniform1f('normal_mix', params.normal);
            pgm.uniform3fv('viewpos', env.camera.view_pos);
            pgm.uniform1f('twist', twist_curr * QWQ.RAD_PER_DEG);

            webgl.bind_vertex_buffer(ob.buffers.position);
            pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

            webgl.bind_vertex_buffer(ob.buffers.normal);
            pgm.vertexAttribPointer('normal', 3, gl.FLOAT, false, 0, 0);

            webgl.bind_vertex_buffer(ob.buffers.tangent);
            pgm.vertexAttribPointer('tangent', 3, gl.FLOAT, false, 0, 0);

            webgl.bind_vertex_buffer(ob.buffers.texcoord);
            pgm.vertexAttribPointer('texcoord', 2, gl.FLOAT, false, 0, 0);

            if (params.wire) {
                webgl.bind_element_buffer(ob.buffers.edge_index);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                gl.drawElements(gl.LINES, ob.edge_index_count, gl.UNSIGNED_INT, 0);
                gl.disable(gl.BLEND);
            } else {
                gl.enable(gl.DEPTH_TEST);
                gl.disable(gl.CULL_FACE);
                //gl.cullFace(gl.BACK);

                webgl.bind_element_buffer(ob.buffers.index);

                var part = ob.parts[part_index];

                var start = 0;
                var count = ob.index_count;

                var part_index = +params.part;
                if (part_index) {
                    var part = ob.parts[part_index - 1];
                    start = part.start << 2;
                    count = part.count;
                }

                gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, start);

                gl.disable(gl.CULL_FACE);
                gl.disable(gl.DEPTH_TEST);
            }
        }

        return {
            draw: draw,
        };

    }());

    canvas.draw = function() {
        if (params.background)
            envmap.draw(this);
        object.draw(this);
    };

    function animate(t) {
        requestAnimationFrame(animate);
        update_twist();
        canvas.redraw();
    }
    animate();

    1 && (function() {
        var gui = new dat.GUI();
        //gui.add(params, 'part', [0, 1, 2]);
        gui.addColor(params, 'color');
        gui.add(params, 'background');
        gui.add(params, 'wire');
        gui.add(params, 'gloss', 0, 6);
        gui.add(params, 'specular', 0, 1);
        gui.add(params, 'f0', 1, 100);
        gui.add(params, 'normal', 0, 1);
        //gui.add(params, 'twist', -100, 100);
    }());

    1 && webgl.load_texture_ktx('data/sky3.ktx').then(tex => {
        envmap.texture = tex;
    });

    var twisting = false;

    $(document).on('keydown', function(e) {
        if (e.keyCode == 32)
            twisting = true;
    });

    $(document).on('keyup', function(e) {
        if (e.keyCode == 32)
            twisting = false;
    });

    var twist_curr = 0.0;
    var twist_prev = 0.0;

    function update_twist() {
        var dt = 1/1.05;

        var twist_next = twist_curr + (twist_curr - twist_prev)*dt;
        twist_prev = twist_curr;
        twist_curr = twist_next;

        if (twisting) {
            twist_curr = QWQ.lerp(twist_curr, 100, 0.002);
        } else {
            twist_curr= QWQ.lerp(twist_curr, 0, 0.20);
        }
    }
}

$(main);
