var USE_TEXLOD_FIX = false;

function main() {

    var canvas = new Canvas3D({
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
            'shaders/textest.glsl',
        ]
    });

    $('#main').prepend(canvas.el);

    var sphere = (function() {

        var ob = null;
        load_objects('data/sphere.msgpack').then(obs => {
            ob = obs.Icosphere;
        });
        
        //var tex = webgl.load_texture('data/nike/nike_CYC.jpg', {flip: 1, mipmap: 1});

        var textures = {
            cubemap: null
        };

        webgl.load_texture_ktx('data/nike/nike_ENVMAP_pmrem.ktx').then(tex => {
            textures.cubemap = tex;
        });

        var programs = {
            textest: webgl.get_program('textest'),
        };

        var mat = mat4.create();
        var mvp = mat4.create();

        function draw(env) {
            if (!ob) return;
            if (!textures.cubemap) return;

            var pgm = programs.textest.use();
            pgm.uniformMatrix4fv('mvp', env.camera.mvp);

            pgm.uniformSamplerCube('t_color', textures.cubemap);

            webgl.bind_vertex_buffer(ob.buffers.position);
            pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

            webgl.bind_vertex_buffer(ob.buffers.normal);
            pgm.vertexAttribPointer('normal', 3, gl.FLOAT, false, 0, 0);

            webgl.bind_vertex_buffer(ob.buffers.texcoord);
            pgm.vertexAttribPointer('texcoord', 2, gl.FLOAT, false, 0, 0);

            webgl.bind_element_buffer(ob.buffers.index);

            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);

            gl.drawElements(gl.TRIANGLES, ob.index_count, gl.UNSIGNED_INT, 0);
        }

        return {
            draw: draw
        };

    }());

    canvas.draw = function() {
        sphere.draw(this);
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
