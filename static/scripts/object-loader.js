var load_objects = (function() {

    function dump_stats(ob) {
        console.log(ob.name, 'verts:', ob.vertex_count, 'tris:', ob.index_count/3);
    }

    function load_objects(url) {
        return fetch(url)
            .then(function(res) { return res.arrayBuffer() })
            .then(function(data) {
                var msg = msgpack.decode(new Uint8Array(data));

                var obs = msg.objects.map(function(ob) { return create_object(ob) });
                var obmap = {};


                var v_total = 0;
                var i_total = 0;

                obs.forEach(function(ob) {
                    obmap[ob.name] = ob;
                    dump_stats(ob);
                    v_total += ob.vertex_count;
                    i_total += ob.index_count;
                });

                dump_stats({
                    name: 'TOTAL',
                    vertex_count: v_total,
                    index_count: i_total
                });

                return obmap;
            });
    }


    function create_object(data) {
        var mesh = data.mesh;

        fix_orientation(mesh.vertex_position);
        fix_orientation(mesh.vertex_normal);
        fix_vertex_uvs(mesh);

        var faces = faces_to_triangles(
            mesh.face_indices,
            mesh.face_lengths,
            mesh.face_material_indices
        );

        mesh.vertex_tangents = calculate_tangents(
            faces.index,
            mesh.vertex_position,
            mesh.vertex_normal,
            mesh.vertex_uv
        );

        var arrays = {
            position: mesh.vertex_position,
            normal: mesh.vertex_normal,
            tangent: mesh.vertex_tangents,
            texcoord: mesh.vertex_uv,
            edge_index: mesh.edge_indices,
            index: faces.index
        };

        var buffers = {
            position: webgl.new_vertex_buffer(arrays.position),
            normal: webgl.new_vertex_buffer(arrays.normal),
            tangent: webgl.new_vertex_buffer(arrays.tangent),
            texcoord: webgl.new_vertex_buffer(arrays.texcoord),
            edge_index: webgl.new_element_buffer(arrays.edge_index),
            index: webgl.new_element_buffer(arrays.index)
        };

        return {
            name: data.name,
            matrix: data.transform.matrix_world,
            arrays: arrays,
            buffers: buffers,
            vertex_count: mesh.vertex_position.length/3,
            edge_index_count: mesh.edge_indices.length,
            index_count: faces.index.length,
            parts: faces.parts
        };
    }

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

        var index_count = _.reduce(parts, function(c, p) { return c + p.length}, 0);
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

        var edge_indices = [];
        var edge_index_count = ob.edge_indices.length;
        for (var i = 0; i < edge_index_count; ++i) {
            var loop_index = i;
            var vertex_index = ob.edge_indices[i];
            var index = get_vertex(loop_index, vertex_index);
            edge_indices.push(index);
        }

        ob.vertex_position = new Float32Array(v_position);
        ob.vertex_normal = new Float32Array(v_normal);
        ob.vertex_uv = new Float32Array(v_texcoord);
        ob.face_indices = new Uint32Array(indices);
        ob.edge_indices = new Uint32Array(edge_indices);
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

    return load_objects;

}());
