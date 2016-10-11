(function() {

    var KTX_MAGIC = [0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A];
    var KTX_ENDIAN = 0x04030201;

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

        var targets = [
            gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
        ];

        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

        var gl_HALF_FLOAT = 5131;

        var gl_COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;
        var gl_COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
        var gl_COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
        var gl_COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83F0;

        if (glType == gl_HALF_FLOAT)
            glType = webgl.extensions.OES_texture_half_float.HALF_FLOAT_OES;

        //console.log(imageSize*6, data.byteLength - sp);

        for (var level = 0; level < numberOfMipmapLevels; ++level) {
            var imageSize = read_u32();
            var levelWidth = pixelWidth >> level;
            var levelHeight = pixelHeight >> level;

            for (var face = 0; face < numberOfFaces; ++face) {
                var target = targets[face];

                var image;
                if (glTypeSize == 2)
                    image = new Uint16Array(data, sp, imageSize/2); 
                else if (glTypeSize == 1)
                    image = new Uint8Array(data, sp, imageSize); 
                else if (glTypeSize == 0)
                    image = new Uint8Array(data, sp, imageSize); 
                else if (glTypeSize == 4)
                    image = new Float32Array(data, sp, imageSize/4); 

                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

                if (glType == 0) {
                    gl.compressedTexImage2D(target, level, glInternalFormat, levelWidth, levelHeight, 0, image); 
                } else {
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
            var levelWidth = pixelWidth >> level;
            var levelHeight = pixelHeight >> level;

            while (true) {
                if (levelWidth == 1 && levelHeight == 1)
                    break;

                level += 1;
                levelWidth = pixelWidth >> level;
                levelHeight = pixelHeight >> level;

                var image = new Uint16Array(3 * levelWidth * levelHeight);

                for (var face = 0; face < numberOfFaces; ++face) {
                    var target = targets[face];
                    gl.texImage2D(target, level, glBaseInternalFormat, levelWidth, levelHeight, 0, glBaseInternalFormat, glType, image);
                }
            }
        }

        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        if (numberOfMipmapLevels > 1) {
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else {
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }

        if (USE_TEXLOD_FIX) {
            // don't mipmap
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            console.log('dont mipmap');
        }

        return texture;
    }

    function load_texture_ktx(url) {
        return fetch(url)
            .then(res => res.arrayBuffer())
            .then(data => {
                console.log('loaded', url);
                return parse_ktx(data);
            });
    }

    webgl.load_texture_ktx = load_texture_ktx;

}());
