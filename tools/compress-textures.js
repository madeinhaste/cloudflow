#!/usr/bin/env node
var fs = require('fs');
var args = require('yargs').argv;
var path = require('path');
var execSync = require('child_process').execSync;
var fileSize = require('file-size');

// i: input path
// s3: DXT
// pvr: PVR
// rgb: force rgb

var src_path = args.i;
if (!Array.isArray(src_path))
    src_path = [src_path];

src_path.forEach(src => {
    args.s3 && encode_texture(src, 's3');
    args.pvr && encode_texture(src, 'pvr');
});

function encode_texture(src_path, enc) {
    //var dst_path = path.parse(src_path).name + '.pvr.ktx';
    var basename = path.parse(src_path).name;
    var dst_path = `${basename}.${enc}.ktx`;
    var dst_br_path = `${dst_path}.br`;

    if (enc == 's3') {
        var cmd = `crunch -DXT5 -file ${src_path} -out ${dst_path}`;
        execSync(cmd);
    }
    else if (enc == 'pvr') {
        var fmt = args.rgb ? 'PVRTC1_4_RGB' : 'PVRTC1_4';
        console.log('format:', fmt);
        var cmd = `PVRTexToolCLI -shh -q pvrtcbest -f ${fmt} -m -i ${src_path} -o ${dst_path}`;
        execSync(cmd);
    }

    var cmd = `brotli --force --input ${dst_path} --output ${dst_br_path}`;
    execSync(cmd);

    console.log('wrote', dst_br_path, fileSize(fs.statSync(dst_br_path).size).human('jedec'));
}
