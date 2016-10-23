// experimental model format with u16 and spherical coords for vector

// decode spherical to xyz
function decode_vec(out, enc_x, enc_y) {
    var angle_x = 2 * (enc_x / 65535) - 1;
    var angle_y = 2 * (enc_y / 65535) - 1;

    var theta_x = Math.sin(Math.PI * angle_x);
    var theta_y = Math.cos(Math.PI * angle_x);

    var phi_x = Math.sqrt(1.0 - angle_y * angle_y);
    var phi_y = ang_y;

    out[0] = theta_y * phi_x;
    out[1] = theta_x * phi_x;
    out[2] = phi_y;
}

function decompress_object(ob) {
    var bbox = ob.bbox;
    var vert_count = ob.position.length/3;

    // todo... maybe interleave?
    var out_pos = new Float32Array(3 * vert_count);
    var out_nor = new Float32Array(3 * vert_count);
    var out_tan = new Float32Array(3 * vert_count);
    var out_tex = new Float32Array(2 * vert_count);

    var src_pos = ob.position;
    var src_nor = ob.normal;
    var src_tan = ob.tangent;
    var src_tex = ob.texcoord;

    var tmp = vec3.create();

    var sp = 0;
    var dp = 0;
    for (var i = 0; i < vert_count; ++i) {
        var x = src_pos[sp + 0];
        var y = src_pos[sp + 1];
        var z = src_pos[sp + 2];

        out_pos[sp + 0] = bbox[0] + (bbox[3] - bbox[0]) * (src_pos[sp + 0] / 65535);
        out_pos[sp + 1] = bbox[1] + (bbox[4] - bbox[1]) * (src_pos[sp + 1] / 65535);
        out_pos[sp + 2] = bbox[2] + (bbox[5] - bbox[2]) * (src_pos[sp + 2] / 65535);

        decode_vec(tmp, src_nor[dp + 0], src_nor[dp + 1]);
        out_nor[sp + 0] = tmp[0];
        out_nor[sp + 1] = tmp[1];
        out_nor[sp + 2] = tmp[2];

        decode_vec(tmp, src_tan[dp + 0], src_tan[dp + 1]);
        out_tan[sp + 0] = tmp[0];
        out_tan[sp + 1] = tmp[1];
        out_tan[sp + 2] = tmp[2];

        out_tex[dp + 0] = src_tex[dp + 0] / 65535;
        out_tex[dp + 1] = src_tex[dp + 1] / 65535;

        sp += 3;
        dp += 2;
    }

    return {
        name: ob.name,
        data: {
            position: out_pos,
            normal: out_nor,
            tangent: out_tan,
            texcoord: out_tex,
            index: ob.index,
            edge_index: ob.edge_index
        }
    };
}
