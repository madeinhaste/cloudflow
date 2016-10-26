#!/usr/bin/env node
var fs = require('fs');
var args = require('yargs').argv;
var path = require('path');
var execSync = require('child_process').execSync;
var msgpack = require('msgpack-lite');
//var msgpack = require('../static/scripts/vendor/msgpack.js');
var _ = require('lodash');

var src_path = args.i;
var dst_path = args.o;

split_models(src_path, dst_path);

function split_models(src_path, dst_path) {
    var data = fs.readFileSync(src_path);
    var obs = msgpack.decode(data);
    var out = {};
    _.each(obs, (v, k) => {
        out[k] = process_object(v);
    });
}

// XXX this is untested code. but the idea sounds ok
// you need to make sure you are not splitting within a triangle element.
// could not find any code for this... eg three
// there's clearly some problem in my blender exporter, as it's exporting a huge
// vertex array of which only some are actually used (maybe subdivied?)

function process_object(ob) {
    var vn = ob.data.position.length / 3;
    //if (vn <= (1<<16)) return ob;

    console.log(ob.name, vn);

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

    /*
    var next_chunk_index = 0;
    var chunk_indices = [];
    var chunk_lengths = [];
    var chunk_offset = 0;

    var src_indices  = ob.data.index;
    var n_src_indices = src_indices.length;
    var sp = 0;
    var sp_end = n_src_indices;
    while (sp < sp_end) {
        var src_index = src_indices[sp++];
        var chunk_index = src_index_to_chunk_index[src_index];
        if (chunk_index === undefined_index_value) {
            // allocate new chunk index
            chunk_index = next_chunk_index++;
            src_index_to_chunk_index[src_index] = chunk_index;
            chunk_indices.push(chunk_index);
        } else {
            // index seen already
            chunk_indices.push(chunk_index);
        }

        if (next_chunk_index == 65536) {
            // end of chunk, reset, start a new chunk...
            clear_src_index_to_chunk_index();
            next_chunk_index = 0;
            var chunk_length = chunk_indices.length - chunk_offset;
            chunk_lengths.push(chunk_length);
            chunk_offset += chunk_length;
        }
    }

    var chunk_length = chunk_indices.length - chunk_offset;
    if (chunk_length) {
        chunk_lengths.push(chunk_length);
    }

    console.log(chunk_lengths);
    */

    var src_indices  = ob.data.index;
    var n_src_indices = src_indices.length;
    var sp = 0;
    var sp_end = n_src_indices;
    while (sp < sp_end) {
        var src_index = src_indices[sp++];
        src_index_to_chunk_index[src_index] = 0;
    }

    console.log('  unused verts:', count_unused_src_indices());

    return ob;
}

/*
    return {
        name: ob.name,
        bbox: bbox,
        position: out_pos,
        normal: out_nor,
        tangent: out_tan,
        texcoord: out_tex,
        index: ob.data.index,
        edge_index: ob.data.edge_index
    };
    */
