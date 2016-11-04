#!/usr/bin/env node
var fs = require('fs');
var args = require('yargs').argv;
var path = require('path');
var _ = require('lodash');

var src_path = args.i;
var dst_path = args.o;

var KTX_MAGIC = [0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A];
var KTX_ENDIAN = 0x04030201;

var gl = {
    RGB: 6407,
    RGBA: 6408,
    FLOAT: 5126,
    UNSIGNED_BYTE: 5121,
    HALF_FLOAT: 5131,

    RGB16F: 0x881b,
    RGBA16F: 0x881a,

    RGB32F: 0x8815,
    RGBA32F: 0x8814,

    RGB8: 0x8051,
    RGBA8: 0x8058,

    RGB10_A2: 0x8059,

    RG8: 0x822b,
};

function convert_ktx(src_path, dst_path) {

    var data = fs.readFileSync(src_path);
    console.log(data.length);

    var ktx = parse_ktx(data.buffer);
    f16_to_rgbm(ktx);
    var buf = ktx.serialize();
    console.log(buf.length + ktx.n_bytes_kv_data);
    console.log(ktx);


    if (dst_path) {
        fs.writeFileSync(dst_path, buf);
        console.log(dst_path);
    }
}

function f16_to_rgbm(ktx) {
    // for each pixel, read rgb into float vec
    // convert to rgbm

    // RGB => RGBA
    // HALF_FLOAT => UNSIGNED_BYTE
    // image_size

    console.assert(ktx.type == gl.HALF_FLOAT);
    console.assert(ktx.type_size == 2);
    console.assert(ktx.format == gl.RGB);
    console.assert(ktx.internal_format = gl.RGB16F);

    ktx.type = gl.UNSIGNED_BYTE;
    ktx.type_size = 1;
    ktx.format = gl.RGBA;
    ktx.internal_format = gl.RGBA8;
    ktx.base_internal_format = gl.RGBA;

    function convert_level(level) {
        var n_pixels = level.width * level.height;
        var image_size = n_pixels * 4;
        level.image_size = image_size;

        level.faces.forEach(face => {
            var out = new Uint8ClampedArray(image_size);
            var src = new Uint16Array(face.data);

            var dp = 0;
            var sp = 0;

            for (var i = 0; i < n_pixels; ++i) {
                var R = decodeFloat16(src[sp + 0]);
                var G = decodeFloat16(src[sp + 1]);
                var B = decodeFloat16(src[sp + 2]);

                R /= 6;
                G /= 6;
                B /= 6;

                var M = Math.max(R, G, B, 1e-6);
                if (M < 0) M = 0;
                if (M > 1) M = 1;
                M = Math.ceil(M * 255.0)/255.0;

                var L = 0.2126 * R + 0.7152 * G + 0.0722 * B;

                R = R / M;
                G = G / M;
                B = B / M;
                L = L / M;

                //out[dp + 0] = R * 256;
                //out[dp + 1] = G * 256;
                //out[dp + 2] = B * 256;
                //out[dp + 3] = M * 256;

                out[dp + 0] = L * 256;
                out[dp + 1] = L * 256;
                out[dp + 2] = L * 256;
                out[dp + 3] = M * 256;

                sp += 3;
                dp += 4;
            }
            face.data = out.buffer;
        });
    }

    var l = ktx.levels[0];
    convert_level(l);
    ktx.levels = [l];
    ktx.n_levels = 1;
    ktx.width = l.width;
    ktx.height = l.height;
}

class KTX {
    constructor() {
        this.type = 0;
        this.type_size = 0;
        this.format = 0;
        this.internal_format = 0;
        this.base_internal_format= 0;

        this.width = 0;
        this.height = 0;
        this.depth = 0;

        this.n_faces = 0;
        this.n_levels = 0;
        this.levels = [];
    }

    serialize() {
        var os = new OutputStream;
        os.write(KTX_MAGIC);
        os.write_u32(KTX_ENDIAN);

        os.write_u32(this.type);
        os.write_u32(this.type_size);
        os.write_u32(this.format);
        os.write_u32(this.internal_format);
        os.write_u32(this.base_internal_format);
        os.write_u32(this.width);
        os.write_u32(this.height);
        os.write_u32(this.depth);
        os.write_u32(this.n_array_elements);
        os.write_u32(this.n_faces);
        os.write_u32(this.n_levels);
        os.write_u32(0);    // n_bytes_kv_data

        this.levels.forEach(level => {
            var image_size = level.image_size;
            os.write_u32(image_size);

            level.faces.forEach(face => {
                os.write(face.data);

                var cube_pad = ((os.length + 3) & ~3) - os.length;
                os.pad(cube_pad);
            });

            var level_pad = 3 - ((image_size + 3) % 4);
            os.pad(level_pad);
        });

        os.done();
        return os.buffer;
    }
}

class OutputStream {
    constructor() {
        this.bl = [];
        this.length = 0;
        this.buffer = null;
    }

    push(b) {
        this.bl.push(b);
        this.length += b.length;
    }

    alloc(n) {
        var b = Buffer.alloc(n);
        this.push(b);
        return b;
    }

    write_u32(x) {
        var b = this.alloc(4);
        b.writeUInt32LE(x, 0);
    }

    write(buf) {
        this.push(Buffer.from(buf));
    }

    pad(n) {
        this.alloc(n);
    }

    done() {
        this.buffer = Buffer.concat(this.bl);
        this.length = this.buffer.length;
        this.bl = [];
    }
}

function parse_ktx(data) {
    if (!check_magic(data)) {
        console.log('ktx: bad magic');
        return;
    }

    var dv = new DataView(data);

    var sp = 12;
    var le = true;

    function read_u32() {
        var value = dv.getUint32(sp, le);
        sp += 4;
        return value;
    }

    function read_string0() {
        var s = '';
        while (true) {
            var c = dv.getUint8(sp++);
            if (c == 0) break;
            s += String.fromCharCode(c);
        }
        return s;
    }

    // correct endianness
    le = (read_u32() == KTX_ENDIAN);
    //console.log(le);

    var glType = read_u32();                    // HALF_FLOAT
    var glTypeSize = read_u32();                // 2
    var glFormat = read_u32();                  // RGB
    var glInternalFormat = read_u32();          // RGB16F
    var glBaseInternalFormat = read_u32();      // RGB
    var pixelWidth = read_u32();                // 128
    var pixelHeight = read_u32();               // 128
    var pixelDepth = read_u32();                // 0
    var numberOfArrayElements = read_u32();     // 0
    var numberOfFaces = read_u32();             // 6
    var numberOfMipmapLevels = read_u32();      // 1
    var bytesOfKeyValueData = read_u32();       // 0

    sp += bytesOfKeyValueData;

    var gl_HALF_FLOAT = 5131;
    var gl_FLOAT = 5126;
    var gl_UNSIGNED_BYTE = 5121;
    var gl_HALF_FLOAT_OES = 36193;

    var gl_COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;
    var gl_COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
    var gl_COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
    var gl_COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83F0;

    var ktx = new KTX;
    ktx.type = glType;
    ktx.type_size = glTypeSize;
    ktx.format = glFormat;
    ktx.internal_format = glInternalFormat;
    ktx.base_internal_format = glBaseInternalFormat;
    ktx.width = pixelWidth;
    ktx.height = pixelHeight;
    ktx.depth = pixelDepth;
    ktx.n_array_elements = numberOfArrayElements;
    ktx.n_faces = numberOfFaces;
    ktx.n_levels = numberOfMipmapLevels;
    ktx.n_bytes_kv_data = bytesOfKeyValueData;

    function mip_size(size, level) {
        return (size >> level) || 1;
    }

    for (var level = 0; level < numberOfMipmapLevels; ++level) {
        var imageSize = read_u32();
        var levelWidth = mip_size(pixelWidth, level);
        var levelHeight = mip_size(pixelHeight, level);

        var ktx_level = {
            index: level,
            image_size: imageSize,
            width: levelWidth,
            height: levelHeight,
            faces: []
        };
        ktx.levels.push(ktx_level);

        for (var face_idx = 0; face_idx < numberOfFaces; ++face_idx) {
            var image = data.slice(sp, sp + imageSize);
            ktx_level.faces.push({ index: face_idx, data: image });
            sp += imageSize;
            sp = (sp + 3) & ~3;
        }

        var pad = 3 - ((imageSize + 3) % 4);
        sp += pad;
    }

   return ktx;
}

function decodeFloat16 (binary) {
    var exponent = (binary & 0x7C00) >> 10;
        fraction = binary & 0x03FF;
    return (binary >> 15 ? -1 : 1) * (
        exponent ?
        (
            exponent === 0x1F ?
            fraction ? NaN : Infinity :
            Math.pow(2, exponent - 15) * (1 + fraction / 0x400)
        ) :
        6.103515625e-5 * (fraction / 0x400)
    );
}

function convert_half_to_float_array(arr) {
    var n = arr.length;
    var out = new Float32Array(n);
    for (var i = 0; i < n; ++i) {
        out[i] = decodeFloat16(arr[i]);
    }
    return out;
}

function check_magic(data) {
    var magic = new Uint8Array(data, 0, 12);
    for (var i = 0; i < magic.length; ++i)
        if (magic[i] !== KTX_MAGIC[i])
            return false;
    return true;
}

convert_ktx(src_path, dst_path);
