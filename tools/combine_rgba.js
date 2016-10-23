#!/usr/bin/env node
var fs = require('fs');
var args = require('yargs').argv;
var path = require('path');
var jpeg = require('jpeg-js');
var PNG = require('pngjs').PNG;
var blur = require('./blur');

function load_image(src_path) {
    var ext = path.extname(src_path);
    var filedata = fs.readFileSync(src_path);

    var image;
    if (ext == '.jpg') {
        image = jpeg.decode(filedata, true);
    } else if (ext == '.png') {
        image = PNG.sync.read(filedata);
    }

    console.log(src_path, image.width, image.height, image.data.length);
    return image;
}

var out;

if (args.color && args.alpha) {
    var color = load_image(args.color);
    var alpha = load_image(args.alpha);

    var w = color.width;
    var h = color.height;
    console.assert(w == alpha.width && h == alpha.height);
    console.assert(color.data.length == alpha.data.length);

    var out = new PNG({ width: w, height: h });

    var dp = 0;
    var dp_end = 4 * w * h;
    var color_src = color.data;
    var alpha_src = alpha.data;
    var dst = out.data;
    while (dp < dp_end) {
        dst[dp + 0] = color_src[dp + 0];
        dst[dp + 1] = color_src[dp + 1];
        dst[dp + 2] = color_src[dp + 2];

        dst[dp + 3] = alpha_src[dp + 1];    // green channel
        dp += 4;
    }
}

else if (args.normal && args.id) {
    var normal = load_image(args.normal);
    var id = load_image(args.id);

    var w = normal.width;
    var h = normal.height;
    console.assert(w == id.width && h == id.height);
    console.assert(normal.data.length == id.data.length);

    var out = new PNG({ width: w, height: h });

    var id1 = 128;
    var id2 = 255;

    var dp = 0;
    var dp_end = 4 * w * h;
    var normal_src = normal.data;
    var id_src = id.data;
    var dst = out.data;
    while (dp < dp_end) {
        // RG = XY from normal map
        dst[dp + 0] = normal_src[dp + 0];
        dst[dp + 1] = normal_src[dp + 1];
        dst[dp + 2] = normal_src[dp + 2];

        // B = object ID
        var b = 0;
        if (id_src[dp + 0]) {
            if (id_src[dp + 1]) {
                // yellow: spd
                b = id1;
            } else {
                // red: mfl
                b = id1;
            }
        } else if (id_src[dp + 1]) {
            // green: zgf
            b = id2;
        } else if (id_src[dp + 2]) {
            // blue: enf
            b = id2;
        }

        dst[dp + 3] = b;
        dp += 4;
    }

    if (args.blur) {
        blur({
            dst: dst,
            width: out.width,
            height: out.height,
            channel: 3,
            sigma: parseFloat(args.blur),
        });
    }
}


if (out && args.output)
    fs.writeFileSync(args.output, PNG.sync.write(out));
