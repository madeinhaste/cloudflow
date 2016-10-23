(function() {

    var KTX_MAGIC = [0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A];
    var KTX_ENDIAN = 0x04030201;

    var gl_TEXTURE_CUBE_MAP_POSITIVE_X = 0x8515;
    var gl_cubemap_faces = _.range(gl_TEXTURE_CUBE_MAP_POSITIVE_X, gl_TEXTURE_CUBE_MAP_POSITIVE_X + 6);
        //gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        //gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        //gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
    //];

    function check_magic(data) {
        var magic = new Uint8Array(data, 0, 12);
        for (var i = 0; i < magic.length; ++i)
            if (magic[i] !== KTX_MAGIC[i])
                return false;
        return true;
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

        //console.assert(bytesOfKeyValueData == 0);
        /*
        if (bytesOfKeyValueData > 0) {
            var keyValueData_end = sp + bytesOfKeyValueData;
            while (sp < keyValueData_end) {
                var keyAndValueByteSize = read_u32();
                //var kvData = new Uint8Array(data, sp, sp + keyAndValueByteSize);

                var key = read_string0();
                var val = read_string0();

                console.log(key, val);

                sp += keyAndValueByteSize;
            }
        }
        */
        sp += bytesOfKeyValueData;

        //console.assert(numberOfArrayElements == 0);

        //var numComponents = 3;
        //var imageSize = pixelWidth * pixelHeight * glTypeSize * numComponents;
        //console.log(6 * imageSize);
        //console.log(data.byteLength - sp);

        //var texture = gl.createTexture();

        var gl_HALF_FLOAT = 5131;

        var gl_COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;
        var gl_COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
        var gl_COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
        var gl_COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83F0;

        // FIXME FIXME FIXME
        // this is all very flakey, regarding cubemaps, halfs etc

        var convert_half_to_float = false;
        if (glType == gl_HALF_FLOAT) {
            glType = gl.FLOAT;
            convert_half_to_float = true;
            //glType = webgl.extensions.OES_texture_half_float.HALF_FLOAT_OES;
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

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

        //console.log(imageSize*6, data.byteLength - sp);
        function mip_size(size, level) {
            return (size >> level) || 1;
        }

        for (var level = 0; level < numberOfMipmapLevels; ++level) {
            var imageSize = read_u32();
            var levelWidth = mip_size(pixelWidth, level);
            var levelHeight = mip_size(pixelHeight, level);

            for (var face_idx = 0; face_idx < numberOfFaces; ++face_idx) {
                var image;
                if (glTypeSize == 2)
                    image = new Uint16Array(data, sp, imageSize/2); 
                else if (glTypeSize == 1)
                    image = new Uint8Array(data, sp, imageSize); 
                else if (glTypeSize == 0)
                    image = new Uint8Array(data, sp, imageSize); 
                else if (glTypeSize == 4)
                    image = new Float32Array(data, sp, imageSize/4); 

                var target = (numberOfFaces == 6) ? gl_cubemap_faces[face_idx] : gl.TEXTURE_2D;

                if (glType == 0) {
                    gl.compressedTexImage2D(target, level, glInternalFormat, levelWidth, levelHeight, 0, image); 
                    //console.log('compressedTexImage2D', target, levelWidth, levelHeight, image.length);
                } else {
                    if (convert_half_to_float) {
                        image = convert_half_to_float_array(image);
                    }
                    gl.texImage2D(target, level, glBaseInternalFormat, levelWidth, levelHeight, 0, glBaseInternalFormat, glType, image);
                }

                sp += imageSize;

                    // cube pad
                sp = (sp + 3) & ~3;
            }

                // mip pad
            var pad = 3 - ((imageSize + 3) % 4);
            sp += pad;
        }

            // need to pad missing mipmaps
        if (numberOfMipmapLevels > 1) {
            var level = numberOfMipmapLevels - 1;
            var levelWidth = mip_size(pixelWidth, level);
            var levelHeight = mip_size(pixelHeight, level);

            while (true) {
                if (levelWidth == 1 && levelHeight == 1)
                    break;

                level += 1;
                levelWidth = pixelWidth >> level;
                levelHeight = pixelHeight >> level;

                var image;
                if (convert_half_to_float)
                    image = new Float32Array(3 * levelWidth * levelHeight);
                else {
                    console.assert(glType == gl_HALF_FLOAT);
                    image = new Uint16Array(3 * levelWidth * levelHeight);
                }

                for (var face_idx = 0; face_idx < numberOfFaces; ++face_idx) {
                    var target = (numberOfFaces == 6) ? gl_cubemap_faces[face_idx] : gl.TEXTURE_2D;
                    gl.texImage2D(target, level, glBaseInternalFormat, levelWidth, levelHeight, 0, glBaseInternalFormat, glType, image);
                }
            }
        }

        // FIXME cubemap / texture2d
        var target = (numberOfFaces == 6) ? gl.TEXTURE_CUBE_MAP : gl.TEXTURE_2D;
        if (numberOfMipmapLevels > 1) {
            gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else {
            gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }

        if (USE_TEXLOD_FIX) {
            // don't mipmap
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            console.log('dont mipmap');
        }
    }

    function load_texture_ktx(url) {
        var label = 'texload: ' + url;
        console.time(label);
        return fetch(url)
            .then(function(res) { return res.arrayBuffer() })
            .then(function(data) {
                console.timeEnd(label);
                return parse_ktx(data);
            });
    }

    // create a new, empty, placeholder texture
    function new_texture(target) {
        var texture = gl.createTexture();

        gl.bindTexture(target, texture);
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        if (target == gl.TEXTURE_2D) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        } else if (target == gl.TEXTURE_CUBE_MAP) {
            _.each(gl_cubemap_faces, function(face) {
                gl.texImage2D(face, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            });
        }

        return texture;
    }

    function load_texture_ktx(target, url, callback) {
        var texture = new_texture(target);
        var label = 'texload: ' + url;
        //console.time(label);
        fetch(url)
            .then(function(res) { return res.arrayBuffer() })
            .then(function(data) {
                if (url.endsWith('.br'))
                    return brotli_decompress2(data);
                else
                    return data;
            })
            .then(function(data) {
                gl.bindTexture(target, texture);
                parse_ktx(data);
                //console.timeEnd(label);
                callback && callback();
            });
        return texture;
    }

    function load_texture_ktx2(target, path, opts, callback) {
        var ext;
        if (opts && opts.uncompressed)
            ext = '.ktx.br';
        else if (webgl.extensions.WEBKIT_WEBGL_compressed_texture_pvrtc)
            ext = '.pvr.ktx.br';
        else if (webgl.extensions.WEBGL_compressed_texture_s3tc)
            ext = '.s3.ktx.br';

        // FIXME: etc, atsc etc

        var texture = webgl.load_texture_ktx(target, path + ext, callback);

        if (opts && opts.wrap) {
            gl.bindTexture(target, texture);
            gl.texParameteri(target, gl.TEXTURE_WRAP_S, opts.wrap);
            gl.texParameteri(target, gl.TEXTURE_WRAP_T, opts.wrap);
        }

        return texture;
    }

    webgl.load_texture_ktx = load_texture_ktx;
    webgl.load_texture_ktx2 = load_texture_ktx2;
    
}());
