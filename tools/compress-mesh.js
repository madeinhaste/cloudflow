#!/usr/bin/env node
var fs = require('fs');
var args = require('yargs').argv;
var path = require('path');
var execSync = require('child_process').execSync;
var fileSize = require('file-size');
//var msgpack = require('./static/scripts/vendor/msgpack.js');
var msgpack = require('msgpack-lite');
var glMatrix = require('./static/scripts/vendor/gl-matrix.js');
var vec3 = glMatrix.vec3;
var vec2 = glMatrix.vec2;

var src_path = args.i;
var dst_path = args.o;

var tmp = vec3.create();
compress_mesh(src_path, dst_path);

function clamp(x, a, b) {
    if (x < a) return a;
    if (x > b) return b;
    return x;
}

function clamp16(x, a, b) {
    x = ~~x;
    if (x < 0) return 0;
    if (x > 0xffff) return 0xffff;
    return x;
}

function encode_vec(out, x, y, z)
{
    tmp[0] = x;
    tmp[1] = y;
    tmp[2] = z;
    vec3.normalize(tmp, tmp);

    var u = Math.atan2(y, x) / Math.PI;
    var v = z;

    u = (u + 1)/2;
    v = (v + 1)/2;

    out[0] = clamp16(65536 * u);
    out[1] = clamp16(65536 * v);
}

function compress_object(ob) {
    var bbox = new Float32Array(6);
    bbox[0] = bbox[1] = bbox[2] = Infinity;
    bbox[3] = bbox[4] = bbox[5] = -Infinity;

    // positions

    var pos = ob.data.position;
    var sp = 0;
    var sp_end = pos.length;
    while (sp < sp_end) {
        var x = pos[sp + 0];
        var y = pos[sp + 1];
        var z = pos[sp + 2];

        bbox[0] = Math.min(bbox[0], x);
        bbox[1] = Math.min(bbox[1], y);
        bbox[2] = Math.min(bbox[2], z);

        bbox[3] = Math.max(bbox[3], x);
        bbox[4] = Math.max(bbox[4], y);
        bbox[5] = Math.max(bbox[5], z);

        sp += 3;
    }

    var vert_count = pos.length/3;

    var out_pos = new Uint16Array(3 * vert_count);
    var out_nor = new Uint16Array(2 * vert_count);
    var out_tan = new Uint16Array(2 * vert_count);
    var out_tex = new Uint16Array(2 * vert_count);

    var src_nor = ob.data.normal;
    var src_tan = ob.data.tangent;
    var src_tex = ob.data.texcoord;

    var tmp = vec2.create();

    var sp = 0;
    var dp = 0;
    for (var i = 0; i < vert_count; ++i) {
        var x = pos[sp + 0];
        var y = pos[sp + 1];
        var z = pos[sp + 2];

        out_pos[sp + 0] = clamp16(65536 * (x - bbox[0]) / (bbox[3] - bbox[0]));
        out_pos[sp + 1] = clamp16(65536 * (y - bbox[1]) / (bbox[4] - bbox[1]));
        out_pos[sp + 2] = clamp16(65536 * (z - bbox[2]) / (bbox[5] - bbox[2]));

        encode_vec(tmp, src_nor[sp + 0], src_nor[sp + 1], src_nor[sp + 2]);
        out_nor[dp + 0] = tmp[0];
        out_nor[dp + 1] = tmp[1];

        encode_vec(tmp, src_tan[sp + 0], src_tan[sp + 1], src_tan[sp + 2]);
        out_tan[dp + 0] = tmp[0];
        out_tan[dp + 1] = tmp[1];

        out_tex[dp + 0] = clamp16(65536 * src_tex[dp + 0]);
        out_tex[dp + 1] = clamp16(65536 * src_tex[dp + 1]);

        sp += 3;
        dp += 2;
    }

    //console.log(ob.name, bbox);

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
}

function compress_mesh(src_path, dst_path) {
    var data = fs.readFileSync(src_path);
    var obs = msgpack.decode(data);

    var out = {};
    Object.keys(obs).forEach(function(name) {
        console.log(name);
        var ob = obs[name];
        out[ob.name] = compress_object(ob);
    });

    var data = msgpack.encode(out);
    fs.writeFileSync(dst_path, data);
    console.log('wrote:', dst_path);
}
