function process_object(ob) {
    var vn = ob.data.position.length / 3;
    var src_index_to_chunk_index = new Uint32Array(vn);
    var undefined_index_value = vn;

    function clear_src_index_to_chunk_index() {
        for (var i = 0; i < vn; ++i)
            src_index_to_chunk_index[i] = undefined_index_value;
    }
    clear_src_index_to_chunk_index();

    function count_unused_src_indices() {
        var count = 0;
        for (var i = 0; i < vn; ++i)
            if (src_index_to_chunk_index[i] === undefined_index_value)
                ++count;
        return count;
    }

    var src_indices  = ob.data.index;
    var n_src_indices = src_indices.length;
    var sp = 0;
    var sp_end = n_src_indices;
    var chunk_indices = [];
    var chunk_index_to_src_index = [];
    var next_chunk_index = 0;
    while (sp < sp_end) {
        var src_index = src_indices[sp++];
        var chunk_index = src_index_to_chunk_index[src_index];
        if (chunk_index === undefined_index_value) {
            // allocate new chunk index
            chunk_index = next_chunk_index++;
            src_index_to_chunk_index[src_index] = chunk_index;
            chunk_index_to_src_index[chunk_index] = src_index;
            chunk_indices.push(chunk_index);
        } else {
            // index seen already
            chunk_indices.push(chunk_index);
        }
    }

    // now copy vertex data
    var n_out_vertices = chunk_index_to_src_index.length;
    var out = {
        position: new Float32Array(3 * n_out_vertices),
        normal: new Float32Array(3 * n_out_vertices),
        tangent: new Float32Array(3 * n_out_vertices),
        texcoord: new Float32Array(2 * n_out_vertices),
        index: new Uint16Array(chunk_indices)
    };

    for (var i = 0; i < n_out_vertices; ++i) {
        var src_index = chunk_index_to_src_index[i];

        var sp = 3 * src_index;
        var dp = 3 * i;
        for (var j = 0; j < 3; ++j) {
            out.position[dp + j] = ob.data.position[sp + j];
            out.normal[dp + j] = ob.data.normal[sp + j];
            out.tangent[dp + j] = ob.data.tangent[sp + j];
        }

        var sp = 2 * src_index;
        var dp = 2 * i;
        for (var j = 0; j < 2; ++j) {
            out.texcoord[dp + j] = ob.data.texcoord[sp + j];
        }
    }

    console.log(ob.name, ':chunk verts:', n_out_vertices);
    return {
        name: ob.name,
        data: out
    };
}

function load_models_msgpack(url) {
    return fetch(url)
        .then(function(res) { return res.arrayBuffer() })
        .then(function(data) {
            if (url.endsWith('.br'))
                return brotli_decompress2(data);
            else
                return data;
        })
        .then(function(data) {
            data = msgpack.decode(new Uint8Array(data));
            obs = {};
            _.each(data, function(ob) {
                //ob = process_object(ob);
                var name = ob.name;
                //console.log('ob:', name, ob.data.index.length/3);
                var buffers = {
                    position: webgl.new_vertex_buffer(ob.data.position),
                    normal: webgl.new_vertex_buffer(ob.data.normal),
                    tangent: webgl.new_vertex_buffer(ob.data.tangent),
                    texcoord: webgl.new_vertex_buffer(ob.data.texcoord),
                    index: webgl.new_element_buffer(ob.data.index),
                    //edge_index: webgl.new_element_buffer(ob.data.edge_index)
                };
                obs[name] = {
                    name: name,
                    arrays: ob.data,
                    buffers: buffers,
                    index_count: ob.data.index.length
                };
            });
            return obs;
        });
}
