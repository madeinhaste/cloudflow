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
                var name = ob.name;
                //console.log('ob:', name, ob.data.index.length/3);
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
            return obs;
        });
}
