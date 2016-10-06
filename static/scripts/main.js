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

    function load_object(url) {
        function fix_orientation(arr) {
            // rotate blender Z-up to Y-up
            var dp_end = arr.length;
            for (var dp = 0; dp < dp_end; dp += 3) {
                var y = arr[dp + 1];
                var z = arr[dp + 2];
                arr[dp + 1] = z;
                arr[dp + 2] = -y;
            }
        }

        function faces_to_triangles(face_indices, face_lengths, face_materials) {
            // sort by material
            var parts = [];

            var sp = 0;
            var src = face_indices;
            for (var i = 0; i < face_lengths.length; ++i) {
                var len = face_lengths[i];
                console.assert(len == 3 || len == 4);

                var slot = face_materials[i];
                if (parts[slot] === undefined) {
                    parts[slot] = [];
                }
                var tris = parts[slot];

                var a = src[sp++];
                var b = src[sp++];
                var c = src[sp++];
                tris.push(a, b, c);

                if (len == 4) {
                    var d = src[sp++];
                    tris.push(a, c, d);
                }
            }

            var index_count = _.reduce(parts, (c, p) => c + p.length, 0);
            var indices = new Uint32Array(index_count);
            var ranges = [];

            var start = 0;
            parts.forEach(function(tris) {
                var count = tris.length;
                indices.set(tris, start);

                ranges.push({
                    start: start,
                    count: count
                });

                start += count;
            });

            return {
                index: indices,
                parts: ranges
            };

            //return parts.map(tris => new Uint32Array(tris));
            //return new Uint32Array(tris);
        }

        function fix_vertex_uvs(ob) {


            var v_position = [];
            var v_normal = [];
            var v_texcoord = [];

            var vertex_map = new Map;

            function get_vertex(loop_index, vertex_index) {
                // lookup loop uv
                var sp = 2 * loop_index;
                var u = ob.vertex_uv[sp + 0];
                var v = ob.vertex_uv[sp + 1];

                // create a key
                var us = ~~(u * 65535.999);
                var vs = ~~(v * 65535.999);
                var uvs = (vs << 16) | us;
                
                var key = vertex_index + ':' + uvs;
                if (vertex_map.has(key)) return vertex_map.get(key);

                var sp = vertex_index * 3;
                var index = v_position.length / 3;
                vertex_map.set(key, index);

                v_position.push(
                    ob.vertex_position[sp + 0],
                    ob.vertex_position[sp + 1],
                    ob.vertex_position[sp + 2]);
                v_normal.push(
                    ob.vertex_normal[sp + 0],
                    ob.vertex_normal[sp + 1],
                    ob.vertex_normal[sp + 2]);
                v_texcoord.push(
                    u,
                    v);

                return index;
            }

            // key is (vertex_index, loop_uv)

            // output indices
            var indices = [];
            var face_index_count = ob.face_indices.length;
            for (var i = 0; i < face_index_count; ++i) {
                var loop_index = i;
                var vertex_index = ob.face_indices[i];
                var index = get_vertex(loop_index, vertex_index);
                indices.push(index);
            }

            /*
            // "fix" uvs...
            var vertex_count = ob.vertex_position.length/3;
            var vertex_uv = new Float32Array(2 * vertex_count);
            var face_index_count = ob.face_indices.length;
            for (var i = 0; i < face_index_count; ++i) {
                var face_index = ob.face_indices[i];
                var dp = 2 * face_index;
                var sp = 2 * i;
                vertex_uv[dp + 0] = ob.vertex_uv[sp + 0];
                vertex_uv[dp + 1] = ob.vertex_uv[sp + 1];
            }
            ob.vertex_uv = vertex_uv;
            */

            ob.vertex_position = new Float32Array(v_position);
            ob.vertex_normal = new Float32Array(v_normal);
            ob.vertex_uv = new Float32Array(v_texcoord);
            ob.face_indices = new Uint32Array(indices);
        }

        function calculate_tangents(indices, position, normal, texcoord) {
            var p01 = vec3.create();
            var p02 = vec3.create();
            var t01 = vec2.create();
            var t02 = vec2.create();

            var sdir = vec3.create();
            var tdir = vec3.create();

            function Vertex() {
                this.position = vec3.create();
                this.texcoord = vec2.create();
            }

            function get_vertex(v, index) {
                v.position[0] = position[3*index + 0];
                v.position[1] = position[3*index + 1];
                v.position[2] = position[3*index + 2];
                v.texcoord[0] = texcoord[2*index + 0];
                v.texcoord[1] = texcoord[2*index + 1];
            }

            var v = [ new Vertex, new Vertex, new Vertex ];
            
            var tangent = new Float32Array(position.length);

            for (var i = 0; i < indices.length; i += 3) {
                get_vertex(v[0], indices[i + 0]);
                get_vertex(v[1], indices[i + 1]);
                get_vertex(v[2], indices[i + 2]);

                vec3.sub(p01, v[1].position, v[0].position);
                vec3.sub(p02, v[2].position, v[0].position);

                vec3.sub(t01, v[1].texcoord, v[0].texcoord);
                vec3.sub(t02, v[2].texcoord, v[0].texcoord);

                var r = 1.0 / (t01[0]*t02[1] - t02[0]*t01[1]);

                sdir[0] = r * (t02[1]*p01[0] - t01[1]*p02[0]);
                sdir[1] = r * (t02[1]*p01[1] - t01[1]*p02[1]);
                sdir[2] = r * (t02[1]*p01[2] - t01[1]*p02[2]);

                //tdir[0] = r * (t02[0]*p02[0] - t01[0]*p01[0]);
                //tdir[1] = r * (t02[0]*p02[1] - t01[0]*p01[1]);
                //tdir[2] = r * (t02[0]*p02[2] - t01[0]*p01[2]);

                for (var j = 0; j < 3; ++j) {
                    var dp = 3 * indices[i + j];
                    tangent[dp + 0] += sdir[0];
                    tangent[dp + 1] += sdir[1];
                    tangent[dp + 2] += sdir[2];
                }
            }

            var tmp = vec3.create();
            var tan = vec3.create();

            for (var i = 0; i < tangent.length; i += 3) {
                tmp[0] = normal[i + 0];
                tmp[1] = normal[i + 1];
                tmp[2] = normal[i + 2];

                tan[0] = tangent[i + 0];
                tan[1] = tangent[i + 1];
                tan[2] = tangent[i + 2];

                vec3.scale(tmp, tmp, vec3.dot(tmp, tan));
                vec3.sub(tmp, tan, tmp);
                vec3.normalize(tan, tmp);

                tangent[i + 0] = tan[0];
                tangent[i + 1] = tan[1];
                tangent[i + 2] = tan[2];
            }

            return tangent;
        }

        return fetch(url)
            .then(res => res.arrayBuffer())
            .then(data => {
                var msg = msgpack.decode(new Uint8Array(data));
                ob = msg.objects[0].mesh;

                fix_orientation(ob.vertex_position);
                fix_orientation(ob.vertex_normal);
                fix_vertex_uvs(ob);

                var faces = faces_to_triangles(ob.face_indices, ob.face_lengths, ob.face_material_indices);

                var vertex_tangents = calculate_tangents(
                    faces.index,
                    ob.vertex_position,
                    ob.vertex_normal,
                    ob.vertex_uv);

                var buffers = {
                    position: webgl.new_vertex_buffer(ob.vertex_position),
                    normal: webgl.new_vertex_buffer(ob.vertex_normal),
                    tangent: webgl.new_vertex_buffer(vertex_tangents),
                    texcoord: webgl.new_vertex_buffer(ob.vertex_uv),
                    edge_index: webgl.new_element_buffer(ob.edge_indices),
                    index: webgl.new_element_buffer(faces.index)
                };

                return {
                    buffers: buffers,
                    vertex_count: ob.vertex_position.length/3,
                    edge_index_count: ob.edge_indices.length,
                    index_count: faces.index.length,
                    parts: faces.parts
                };
            });
    }

    var envmap = (function() {

        var ob = null;
        load_object('data/sphere.msgpack').then(o => { ob = o });

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
        load_object('data/cloudflow_01_40k.msgpack').then(o => { ob = o });

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
