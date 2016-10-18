// a little WebGL sugar
var webgl = (function() {

    // keeps track of array flag of the vertex attributes
    var attribArrayManager = {
        enabledMask: 0,
        maxEnabledIndex: -1,

        disableAll: function() {
            for (var index = 0; index <= this.maxEnabledIndex; ++index) {
                var mask = 1 << index;
                if (mask & this.enabledMask)
                    gl.disableVertexAttribArray(index);
            }

            this.enabledMask = 0;
            this.maxEnabledIndex = -1;
        },

        enable: function(index) {
            var mask = 1 << index;
            if (!(mask & this.enabledMask)) {
                gl.enableVertexAttribArray(index);
                this.enabledMask |= mask;
                this.maxEnabledIndex = Math.max(this.maxEnabledIndex, index);
            }
        },

        disable: function(index) {
            var mask = 1 << index;
            if (mask & this.enabledMask) {
                gl.disableVertexAttribArray(index);
                this.enabledMask &= ~mask;
                // XXX don't bother changing maxEnabledIndex
            }
        },
    };

    // program class
    function Program(name) {
        this.name = name;
        this.program = null;

        this.attribs = {};
        this.uniforms = {};
    }

    Program.prototype.set_program = function(program) {
        this.program = program;

        var numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (var i = 0; i < numAttribs; ++i) {
            var attrib = gl.getActiveAttrib(program, i);
            this.attribs[attrib.name] = {
                index: gl.getAttribLocation(program, attrib.name),
                name: attrib.name,
                size: attrib.size,
                type: attrib.type,
            };
        }

        var nextTexUnit = 0;
        function assignTexUnit(uniform) {
            if (uniform.type == gl.SAMPLER_2D || uniform.type == gl.SAMPLER_CUBE) {
                var unit = nextTexUnit;
                nextTexUnit += uniform.size;
                return unit;
            }

            return -1;
        }

        var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < numUniforms; ++i) {
            var uniform = gl.getActiveUniform(program, i);
            this.uniforms[uniform.name] = {
                location: gl.getUniformLocation(program, uniform.name),
                name: uniform.name,
                size: uniform.size,
                type: uniform.type,
                texUnit: assignTexUnit(uniform),
            };
        }
    };

    Program.prototype.use = function() {
        gl.useProgram(this.program);
        attribArrayManager.disableAll();
        return this;
    };

    Program.prototype.getUniformLocation = function(name) {
        var uniform = this.uniforms[name];
        //console.assert(uniform, 'missing uniform: '+name);
        return uniform ? uniform.location : null;
    };

    Program.prototype.getAttribIndex = function(name) {
        var attrib = this.attribs[name];
        //console.assert(uniform, 'missing attrib: '+name);
        return attrib ? attrib.index : -1;
    };

    Program.prototype.uniform1i = function(name, x) {
        var location = this.getUniformLocation(name);
        if (location)
            gl.uniform1i(location, x);
    };

    Program.prototype.uniform1f = function(name, x) {
        var location = this.getUniformLocation(name);
        if (location)
            gl.uniform1f(location, x);
    };

    Program.prototype.uniform2f = function(name, x, y) {
        var location = this.getUniformLocation(name);
        if (location)
            gl.uniform2f(location, x, y);
    };

    Program.prototype.uniform3f = function(name, x, y, z) {
        var location = this.getUniformLocation(name);
        if (location)
            gl.uniform3f(location, x, y, z);
    };

    Program.prototype.uniform4f = function(name, x, y, z, w) {
        var location = this.getUniformLocation(name);
        if (location)
            gl.uniform4f(location, x, y, z, w);
    };

    Program.prototype.uniform1iv = function(name, v) {
        var location = this.getUniformLocation(name);
        if (location)
            gl.uniform1iv(location, v);
    };

    Program.prototype.uniform1fv = function(name, v) {
        var location = this.getUniformLocation(name);
        if (location)
            gl.uniform1fv(location, v);
    };

    Program.prototype.uniform2fv = function(name, v) {
        var location = this.getUniformLocation(name);
        if (location)
            gl.uniform2fv(location, v);
    };

    Program.prototype.uniform3fv = function(name, v) {
        var location = this.getUniformLocation(name);
        if (location)
            gl.uniform3fv(location, v);
    };

    Program.prototype.uniform4fv = function(name, v) {
        var location = this.getUniformLocation(name);
        if (location)
            gl.uniform4fv(location, v);
    };

    Program.prototype.uniformMatrix3fv = function(name, data, transpose) {
        var location = this.getUniformLocation(name);
        if (location) {
            transpose = transpose || false;
            gl.uniformMatrix3fv(location, transpose, data);
        }
    };

    Program.prototype.uniformMatrix4fv = function(name, data, transpose) {
        var location = this.getUniformLocation(name);
        if (location) {
            transpose = transpose || false;
            gl.uniformMatrix4fv(location, transpose, data);
        }
    };

    Program.prototype.uniformSampler = function(name, target, texture) {
        var uniform = this.uniforms[name];
        if (uniform) {
            gl.activeTexture(gl.TEXTURE0 + uniform.texUnit);
            gl.bindTexture(target, texture);
            gl.uniform1i(uniform.location, uniform.texUnit);
        }
    };

    Program.prototype.uniformSampler2D = function(name, texture) {
        this.uniformSampler(name, gl.TEXTURE_2D, texture);
    };

    Program.prototype.uniformSamplerCube = function(name, texture) {
        this.uniformSampler(name, gl.TEXTURE_CUBE_MAP, texture);
    };

    Program.prototype.enableVertexAttribArray = function(name) {
        var attrib = this.attribs[name];
        if (attrib) {
            attribArrayManager.enable(attrib.index);
            return attrib.index;
        } else {
            return -1;
        }
    };

    Program.prototype.disableVertexAttribArray = function(name) {
        var attrib = this.attribs[name];
        if (attrib) {
            attribArrayManager.disable(attrib.index);
            return attrib.index;
        } else {
            return -1;
        }
    };

    Program.prototype.vertexAttribPointer = function(name, size, type, normalize, offset, stride) {
        var attrib = this.attribs[name];
        if (attrib) {
            attribArrayManager.enable(attrib.index);
            gl.vertexAttribPointer(attrib.index, size, type, normalize, offset, stride);
        }
    };

    // program creation
    function createShader(type, source, name) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            return shader;

        // compilation error
        var log = gl.getShaderInfoLog(shader);
        console.log('Shader: '+name);
        console.log('Type: '+(type == gl.VERTEX_SHADER ? 'vertex' : 'fragment'));

        QWQ.each_line(source, function(line, i) {
            var lineNumber = ('  '+(i + 1)).slice(-3);
            console.log(lineNumber+': '+line);
        });

        throw {
            type: 'COMPILE',
            shaderType: (type == gl.VERTEX_SHADER ? 'vertex' : 'fragment'),
            name: name,
            shader: shader,
            source: gl.getShaderSource(shader),
            log: gl.getShaderInfoLog(shader),
        };
    }

    function createProgram(options) {
        //var FRAGMENT_HEADER = 'precision mediump float;\n';
        var FRAGMENT_HEADER = 'precision highp float;\n';
        var program = gl.createProgram();
        gl.attachShader(program, createShader(gl.VERTEX_SHADER, options.vertexSource, options.name));
        gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, FRAGMENT_HEADER + options.fragmentSource, options.name));
        gl.linkProgram(program);

        if (gl.getProgramParameter(program, gl.LINK_STATUS))
            return program;

        // link error
        throw {
            type: 'LINK',
            name: options.name,
            program: program,
            log: gl.getProgramInfoLog(program),
        };
    }

    // program loader
    var shaderSources = {};
    function fetchShaderSources(urls) {
        shaderSources = {};

        function processSourceText(text) {
            var regex = /^\/\/\s*(\w+(?:.(vertex|fragment))?)\s*\/\//;
            var source = [];
            QWQ.each_line(text,  function(line) {
                var m = regex.exec(line);
                if (m) {
                    var key = m[1];
                    shaderSources[key] = source = [];
                } else {
                    source.push(line);
                }
            });
        }

        // XXX synchronous
        _.each(urls, function(url) {
            $.ajax({
                url: url,
                async: false,
                cache: false,
                success: processSourceText,
            });
        });

        // concatenate lines
        _.each(shaderSources, function(source, key) {
            shaderSources[key] = source.join('\n');
        });
    }

    var get_program = (function() {
        function checkSourceExists(name) {
            var exists = !!shaderSources[name];
            console.assert(exists, name+' not found.');
            return exists;
        }

        function makeProgram(name, options) {
            if (!(checkSourceExists(name) &&
                  checkSourceExists(name+'.vertex') &&
                  checkSourceExists(name+'.fragment')))
            {
                return;
            }

            options = options || {};

            var defines = '';
            if (options.defines) {
                _.each(options.defines, function(dv, dk) {
                    defines += '#define '+dk+' '+dv+'\n';
                });
            }

            // common functions, uniforms, varyings etc
            var common = defines + (shaderSources[name] || '');

            // remove attributes for fragment shader
            var commonFragment = _.reject(common.split('\n'), function(line) {
                    return line.match(/attribute/);
                }).join('\n');

            try {
                var program = new Program(name);
                program.set_program(createProgram({
                    name: name,
                    vertexSource: common + shaderSources[name+'.vertex'],
                    fragmentSource: commonFragment + shaderSources[name+'.fragment'],
                }));

                return program;
            }
            catch (error) {
                onGLSLError(error);
                return null;
            }
        }

        function hashProgram(name, options) {
            var defs = [];
            if (options && options.defines) {
                _.each(options.defines, function(dv, dk) {
                    defs.push(dk+'='+dv);
                });
            }

            return name+' '+defs.join(' ');
        }

        return _.memoize(makeProgram, hashProgram);
    })();

    // render texture
    function RenderTexture(width, height, depth, dataType) {
        this.width = width;
        this.height = height;

        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        this.dataType = dataType || gl.UNSIGNED_BYTE;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, this.dataType, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
        this.depthTexture = null;
        this.depthRenderbuffer = null;

        var depth;
        if (depth === true) {
            // defualt is renderbuffer
            depth = 'RENDERBUFFER';
        }
        
        if (!depth) {
            depth = 'NONE';
        }

        switch (depth) {
            case 'TEXTURE':
                this.depthTexture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depthTexture, 0);
                break;

            case 'RENDERBUFFER':
                this.depthRenderbuffer = gl.createRenderbuffer();
                gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthRenderbuffer);
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthRenderbuffer);
                gl.bindRenderbuffer(gl.RENDERBUFFER, null);
                break;

            default:
                /* no depth attachment */
                break;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    RenderTexture.prototype.render = function(callback) {
        var vp = gl.getParameter(gl.VIEWPORT);
        gl.viewport(0, 0, this.width, this.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

        callback();

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(vp[0], vp[1], vp[2], vp[3]);
    };

    RenderTexture.prototype.resize = function(width, height) {
        this.width = width;
        this.height = height;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, this.dataType, null);

        if (this.depthTexture) {
            gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
        }

        if (this.depthRenderbuffer) {
            gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthRenderbuffer);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
            gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        }
    };

    // webgl object
    return _.assign(this, {
        new_buffer: function(target, data, usage) {
            usage = usage || gl.STATIC_DRAW;
            var buffer = gl.createBuffer();
            gl.bindBuffer(target, buffer);
            gl.bufferData(target, data, usage);
            return buffer;
        },

        new_vertex_buffer: function(arr, usage) {
            return this.new_buffer(gl.ARRAY_BUFFER, arr, usage);
        },

        new_element_buffer: function(arr, usage) {
            return this.new_buffer(gl.ELEMENT_ARRAY_BUFFER, arr, usage);
        },

        bind_vertex_buffer: function(buffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        },

        bind_element_buffer: function(buffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        },

        setup_canvas: function(canvas, options) {
            options = options || {};
            options = _.defaults(options, {
                antialias: false,
                preserveDrawingBuffer: true,
                extensions: [],
                shaderSources: [ 'shaders/all-shaders.glsl' ],
            });

            function tryContext(type) {
                try {
                    return canvas.getContext(type, options);
                }
                catch (e) {
                    // XXX return the exception?
                    return null;
                }
            }

            var gl = tryContext('webgl') || tryContext('experimental-webgl');
            if (gl) {
                var extensions = this.extensions = {};
                _.each(options.extensions, function(name) {
                    extensions[name] = gl.getExtension(name);
                    //console.log(name, extensions[name]);
                });

                window.gl = gl;

                // load the shaders
                fetchShaderSources(options.shaderSources);
            }

            return gl;
        },

        get_program: get_program,

        new_texture: function(options) {
            var texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);

            options = options || {};
            options.width = options.width || options.size || 4;
            options.height = options.height || options.width;
            options.format = options.format || gl.RGBA;
            options.type = options.type || gl.UNSIGNED_BYTE;
            options.mag = options.mag || options.filter || gl.NEAREST;
            options.min = options.min || options.mag;

            options.wrapS = options.wrapS || options.wrap || gl.CLAMP_TO_EDGE;
            options.wrapT = options.wrapT || options.wrapS;

            options.dataFormat = options.dataFormat || options.format;
            options.data = options.data || null;

            var level = 0;
            var border = 0;

            gl.texImage2D(gl.TEXTURE_2D, level, options.format,
                          options.width, options.height, border,
                          options.dataFormat, options.type, options.data);

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.min);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, options.mag);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, options.wrapS);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, options.wrapT);

            if (options.aniso) {
                var ext = webgl.extensions.EXT_texture_filter_anisotropic;
                ext && gl.texParameteri(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, options.aniso);
            }

            return texture;
        },

        load_texture: function(url, options) {
            options = options || {};
            options = _.defaults(options, {
                mipmap: false,
                flip: false,
                callback: null,
                filter: gl.LINEAR,
            });

            var texture = this.new_texture(options);

            var image = new Image();
            if (options.cors) image.crossOrigin = 'anonymous';
            image.src = url;
            image.onload = function() {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, options.flip ? 1 : 0);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

                if (options.mipmap) {
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                    gl.generateMipmap(gl.TEXTURE_2D);
                }

                if (options.callback)
                    options.callback(texture);
            };

            return texture;
        },

        RenderTexture: RenderTexture,
    });

}).call(webgl || {});


// GLSL error reporting
// UGH!
window.onGLSLError = function(error) {
    console.log('GLSL error:', error);

    var errors = {};
    QWQ.each_line(error.log, function(e, i) {
        var match = e.match(/^ERROR: \d+:(\d+):(.*)$/);
        if (match) {
            var line = parseInt(match[1]);
            var desc = match[2];

            if (!errors[line])
                errors[line] = [];

            errors[line].push(desc);
        }
    });

    console.log(errors);

    switch (error.type) {
        case 'COMPILE':
            html = "<div class=\"description\">GLSL compile error in " + (error.shaderType.toLowerCase()) + " shader \"" + error.name + "\":</div>";

            QWQ.each_line(error.source, function(line, index) {
                var descs = errors[index+1];
                if (descs) {
                    descs = _.map(descs, function(desc) {
                        return "<div class='description'>" + desc + "</div>";
                    }).join('');

                    html += "<span class='highlight'>" + line + "</span> " + descs;
                }
                else
                {
                    html += line + '\n';
                }
            });

            break;

        case 'LINK':
            html = "<div class=\"description\">GLSL link error in program \"" + error.name + "\":<br/>\n" + error.log + "\n</div>";
            break;
    }

    $('.glsl-error').html('<code>' + html + '</code>').show();
};

// vertex arrays & geometry utils
var webgl = (function() {

    // triangle cross product for normals & areas
    var triangle_cross = (function() {
        var ab = vec3.create();
        var ac = vec3.create();
        return function(out, a, b, c) {
            vec3.sub(ab, b, a);
            vec3.sub(ac, c, a);
            return vec3.cross(out, ab, ac);
        };
    })();

    var triangle_area = (function() {
        var tmp = vec3.create();
        return function(a, b, c) {
            triangle_cross(tmp, a, b, c);
            return 0.5 * vec3.length(tmp);
        }
    })();

    this.VertexArray = (function() {

        var re_attrib_format = /([1-4])(f|x|b|ub|s|us)(\*?)/;

        var attrib_types = {
            f: {
                type: 'float',
                size: 4,
                dataview_get: DataView.prototype.getFloat32,
                dataview_set: DataView.prototype.setFloat32,
            },

            x: {
                type: 'fixed',
                size: 4,
                dataview_get: DataView.prototype.getUint32, // XXX correct?
                dataview_set: DataView.prototype.setUint32,
            },

            b: {
                type: 'byte',
                size: 1,
                dataview_get: DataView.prototype.getInt8,
                dataview_set: DataView.prototype.setInt8,
            },

            ub: {
                type: 'unsigned_byte',
                size: 1,
                dataview_get: DataView.prototype.getUint8,
                dataview_set: DataView.prototype.setUint8,
            },

            s: {
                type: 'short',
                size: 2,
                dataview_get: DataView.prototype.getInt16,
                dataview_set: DataView.prototype.setInt16,
            },

            us: {
                type: 'unsigned_short',
                size: 2,
                dataview_get: DataView.prototype.getUint16,
                dataview_set: DataView.prototype.setUint16,
            },
        };

        function VertexAttrib(name, format) {
            this.name = name;
            var m = re_attrib_format.exec(format);
            console.assert(m, 'Bad attribute format');
            this.format = format;

            this.size = parseInt(m[1]);

            var t = attrib_types[m[2]];
            this.type = gl[t.type.toUpperCase()];

            this.normalized = !!m[3];
            this.byte_size = this.size * t.size;
            this.byte_offset = 0;   // WARNING: not set until layout is complete

            var self = this;

            this.get = function(view, byte_offset, v) {
                var sp = byte_offset + self.byte_offset;
                if (this.size === 1) {
                    return t.dataview_get(view, sp, true);
                } else {
                    for (var i = 0; i < self.size; ++i) {
                        v[i] = t.dataview_get.call(view, sp, true);
                        sp += t.size;
                    }
                    return v;
                }
            };

            this.set = function(view, byte_offset, v) {
                var dp = byte_offset + self.byte_offset;
                if (this.size === 1) {
                    t.dataview_set(view, dp, v, true);
                } else {
                    for (var i = 0; i < self.size; ++i) {
                        t.dataview_set.call(view, dp, v[i], true);
                        dp += t.size;
                    }
                }
            };

            switch (this.size) {
                case 1:
                    this.create = function() { return 0 };
                    break;
                case 2:
                    this.create = vec2.create;
                    break;
                case 3:
                    this.create = vec3.create;
                    break;
                case 4:
                    this.create = vec4.create;
                    break;
            }

            // XXX integer types?
        }

        function VertexArray() {
            var length = 0;
            var layout = null;

            if (_.isNumber(arguments[0])) {
                length = arguments[0];
                layout = arguments[1];
            } else {
                layout = arguments[0];
            }

            var self = this;
            this.layout = {};
            var byte_offset = 0;
            _.each(layout, function(format, name) {
                var attrib = new VertexAttrib(name, format);

                attrib.byte_offset = byte_offset;
                byte_offset += attrib.byte_size;

                self.layout[name] = attrib;
            });

            this.byte_stride = byte_offset;

            this.length = length || 0;
            this.buffer = new ArrayBuffer(this.byte_stride * (length ? length : 1));
            this.buffer_view = new DataView(this.buffer);
        }

        VertexArray.prototype.gl_attrib_pointer = function(name, index, instanced) {
            if (index < 0)
                return;

            var attrib = this.layout[name];
            gl.vertexAttribPointer(index, attrib.size, attrib.type, attrib.normalized, this.byte_stride, attrib.byte_offset);
            if (instanced) {
                webgl.extensions.ANGLE_instanced_arrays.vertexAttribDivisorANGLE(index, 1);
            }
        };

        VertexArray.prototype.struct = function(v) {
            var v = {};   // Object.create(Object.prototype)
            _.each(this.layout, function(attrib, name) {
                v[name] = attrib.create();
            });
            return v;
        };

        VertexArray.prototype.append = function(v) {
            // ensure the underlying buffer is big enough
            var byte_capacity = this.buffer.byteLength;
            var required_byte_capacity = ((this.length + 1) * this.byte_stride);
            if (byte_capacity < required_byte_capacity) {
                var new_byte_capacity = byte_capacity << 1;
                var new_buffer = new ArrayBuffer(new_byte_capacity);
                (new Uint8Array(new_buffer)).set(new Uint8Array(this.buffer));

                // FIXME: _resize_buffer(byte_capacity) operation
                this.buffer = new_buffer;
                this.buffer_view = new DataView(this.buffer);
            }

            // save the vertex
            this.save(v, this.length++);
        };

        // alias
        VertexArray.prototype.push = VertexArray.prototype.append;

        VertexArray.prototype.trim = function() {
            // trim excess capacity
            var byte_capacity = this.buffer.byteLength;
            var required_byte_capacity = this.length * this.byte_stride;
            if (required_byte_capacity < byte_capacity) {
                this.buffer = this.buffer.slice(0, required_byte_capacity);
                this.buffer_view = new DataView(this.buffer);
            }
        };

        // vertex accessors
        VertexArray.prototype.save = function(v, index) {
            var view = this.buffer_view;
            var byte_offset = index * this.byte_stride;
            _.each(this.layout, function(attrib) {
                attrib.set(view, byte_offset, v[attrib.name]);
            });
        };

        VertexArray.prototype.load = function(v, index) {
            var view = this.buffer_view;
            var byte_offset = index * this.byte_stride;
            _.each(this.layout, function(attrib) {
                v[attrib.name] = attrib.get(view, byte_offset, v[attrib.name]);
            });
        };

        // iterators
        VertexArray.prototype.each = function(fn) {
            // FIXME cache this
            var v = this.struct();

            for (var i = 0; i < this.length; ++i) {
                this.load(v, i);
                fn(v, i);   // XXX maybe return true to save?
                this.save(v, i);
            }
        };

        VertexArray.prototype.each_triangle = function(fn) {
            // FIXME cache this
            var v = [
                this.struct(),
                this.struct(),
                this.struct(),
                ];
            
            for (var i = 0; i < this.length; i += 3) {
                for (var j = 0; j < 3; ++j)
                    this.load(v[j], i + j);

                fn(v, i/3);

                for (var j = 0; j < 3; ++j)
                    this.save(v[j], i + j);
            }
        };

        VertexArray.prototype.each_triangle_indexed = function(elems, fn) {
            // FIXME cache this
            var v = [
                this.struct(),
                this.struct(),
                this.struct(),
                ];
            
            for (var i = 0; i < elems.length; i += 3) {
                for (var j = 0; j < 3; ++j)
                    this.load(v[j], elems[i + j]);

                fn(v, i/3);

                for (var j = 0; j < 3; ++j)
                    this.save(v[j], elems[i + j]);
            }
        };

        return VertexArray;

    })();

    this.GeometryUtils = (function() {
        
        // calculate normals
        var tmp = vec3.create();

        function calculate_normals(va, elems) {
            function accumulate_normal(v) {
                triangle_cross(tmp, v[0].position, v[1].position, v[2].position);
                for (var i = 0; i < 3; ++i)
                    vec3.add(v[i].normal, v[i].normal, tmp);
            }

            if (elems)
                va.each_triangle_indexed(elems, accumulate_normal);
            else
                va.each_triangle(accumulate_normal);

            va.each(function(v) {
                vec3.normalize(v.normal, v.normal);
            });
        }

        function calculate_tangents(va, elems) {
            var p01 = vec3.create();
            var p02 = vec3.create();
            var t01 = vec2.create();
            var t02 = vec2.create();

            var sdir = vec3.create();
            //var tdir = vec3.create();

            function accumulate_tangent(v) {
                vec3.sub(p01, v[1].position, v[0].position);
                vec3.sub(p02, v[2].position, v[0].position);

                vec3.sub(t01, v[1].texcoord, v[0].texcoord);
                vec3.sub(t02, v[2].texcoord, v[0].texcoord);

                var r = 1.0 / (t01[0]*t02[1] - t02[0]*t01[1]);

                sdir[0] = r * (t02[1]*p01[0] - t01[1]*p02[0]);
                sdir[1] = r * (t02[1]*p01[1] - t01[1]*p02[1]);
                sdir[2] = r * (t02[1]*p01[2] - t01[1]*p02[2]);

                //tdir[0] = r * (t02[0]*p02[0] - t01[0]*p01[0]);
                //tdir[1] = r * (t02[0]*p02[1] - t01[0]*p01[1]);
                //tdir[2] = r * (t02[0]*p02[2] - t01[0]*p01[2]);

                for (var i = 0; i < 3; ++i) {
                    vec3.add(v[i].tangent, v[i].tangent, sdir);
                    //vec3.add(v[i].bitangent, v[i].bitangent, tdir);
                }
            }

            if (elems)
                va.each_triangle_indexed(elems, accumulate_tangent);
            else
                va.each_triangle(accumulate_tangent);

            var tmp = vec3.create();

            // Gram-Schmidt orthogonalize
            va.each(function(v) {
                vec3.scale(tmp, v.normal, vec3.dot(v.normal, v.tangent));
                vec3.sub(tmp, v.tangent, tmp);
                vec3.normalize(v.tangent, tmp);
            });
        }

        function calculate_bounding_box(va) {
            var min = vec3.fromValues(Infinity, Infinity, Infinity);
            var max = vec3.negate(vec3.create(), min);
            va.each(function(v) {
                vec3.min(min, min, v.position);
                vec3.max(max, max, v.position);
            });
            return {
                min: min,
                max: max,
            };
        }

        // positions only!
        function transform_mat4(va, mat) {
            va.each(function(v) {
                vec3.transformMat4(v.position, v.position, mat);
            });
        }

        // for sampling random points on a mesh
        function SurfaceSampler(va, elems) {
            this.va = va;
            this.elems = elems;
            this.face_count = elems.length/3;
            this.areas = new Float32Array(this.face_count);
            this.total_area = 0.0;

            var tmp = vec3.create();
            var self = this;
            va.each_triangle_indexed(elems, function(v, i) {
                var area = triangle_area(v[0].position, v[1].position, v[2].position);
                if (isNaN(area)) {
                    // guard degenerates
                    area = 0.0;
                }
                self.areas[i] = self.total_area;
                self.total_area += area;
            });

            // for triangle sampler
            this.v = va.struct();
            this.coord = vec3.create();
        }

        function random_barycentric(coord) {
            coord[0] = Math.random();
            coord[1] = Math.random();
            if ((coord[0] + coord[1]) > 1.0) {
                coord[0] = 1.0 - coord[0];
                coord[1] = 1.0 - coord[1];
            }
            coord[2] = 1.0 - coord[0] - coord[1];
        }

        // FIXME tidy up nrm etc
        SurfaceSampler.prototype.sample = function(out, nrm, tan) {
            // cumulative area
            var value = Math.random() * this.total_area;

            // binary search for cumulative area
            var high = this.face_count - 1;
            var low = 0;
            var face = 0;
            while (low <= high) {
                var mid = (low + high) >> 1;
                var area = this.areas[mid];
                if (area > value) {
                    high = mid - 1;
                }
                else if (area < value) {
                    low = mid + 1;
                }
            }
            face = high;

            // sample triangle
            var coord = this.coord;
            random_barycentric(coord);

            var v = this.v;
            vec3.set(out, 0, 0, 0);
            nrm && vec3.set(nrm, 0, 0, 0);
            tan && vec3.set(tan, 0, 0, 0);

            for (var i = 0; i < 3; ++i) {
                this.va.load(v, this.elems[3*face + i]);
                vec3.scaleAndAdd(out, out, v.position, coord[i]);
                nrm && vec3.scaleAndAdd(nrm, nrm, v.normal, coord[i]);
                tan && vec3.scaleAndAdd(tan, tan, v.tangent, coord[i]);
            }
            nrm && vec3.normalize(nrm, nrm);
            tan && vec3.normalize(tan, tan);
        };

        function save_vertex_array(va) {
            var layout = {};
            _.each(va.layout, function(attrib) {
                layout[attrib.name] = attrib.format;
            });
            return {
                layout: layout,
                buffer: QWQ.base64_encode(va.buffer)
            };
        }

        function load_vertex_array(json) {
            var va = new webgl.VertexArray(json.layout);
            var buffer = QWQ.base64_decode(json.buffer, Uint8Array);

            // FIXME this is nasty (set_buffer or something)
            va.buffer = buffer.buffer;
            va.buffer_view = new DataView(va.buffer);
            va.length = va.buffer.byteLength / va.byte_stride;

            return va;
        }

        return {
            calculate_normals: calculate_normals,
            calculate_tangents: calculate_tangents,
            calculate_bounding_box: calculate_bounding_box,
            transform_mat4: transform_mat4,
            SurfaceSampler: SurfaceSampler,
            save_vertex_array: save_vertex_array,
            load_vertex_array: load_vertex_array,
        };

    })();

    return this;

}).call(webgl || {});

// simplified camera. just takes care of matrices etc
var webgl = (function() {

    function Camera() {
        // projection parameters
        this.fov = 60;
        this.near = 0.01;
        this.far = 150;

        // matrices
        this.viewport = vec4.fromValues(0, 0, 1, 1);
        this.proj = mat4.create();
        this.view = mat4.create();
        this.bill = mat3.create();
        this.mvp = mat4.create();
        this.inv_mvp = mat4.create();
        this.inv_view = mat4.create();
        this.inv_proj = mat4.create();
        this.view_pos = vec3.create();
        this.view_dir = vec3.create();

        this.wide = 1024/720;
        this.wide = 1;
    }
    Camera.use_frustum = true;

    var YUP = vec3.fromValues(0, 1, 0);
    var ref = vec3.create();

    function my_perspective(out, fovy, aspect, near, far, dx, dy) {
        if (!Camera.use_frustum) {
            mat4.perspective(out, fovy, aspect, near, far);
            return;
        }

        dx = dx || 0;
        dy = dy || 0;

        var T = 1.0*near * Math.tan(fovy/2);
        var B = -T;

        var R = T*aspect;
        var L = -R;

        var N = near;
        var F = far;

        dx *= (R - L);
        dy *= (T - B);
        
        mat4.frustum(out, L-dx, R-dx, B-dy, T-dy, N, F);
    }

    Camera.prototype.update_jitter = function(dx, dy) {
        var aspect = this.viewport[2] / this.viewport[3];

        dx /= this.viewport[2];
        dy /= this.viewport[3];

        my_perspective(this.proj, this.fov * QWQ.RAD_PER_DEG, aspect, this.near, this.far, dx, dy);

        // combined
        mat4.multiply(this.mvp, this.proj, this.view);
        mat4.invert(this.inv_mvp, this.mvp);
        mat4.invert(this.inv_view, this.view);
        mat4.invert(this.inv_proj, this.proj);
    };

    var R = vec3.create();
    var U = vec3.create();
    var P = vec3.create();
    var F = vec3.create();

    var theta = 0.0;
    Camera.prototype.update = function(pos, dir, up) {
        up = up || YUP;
        var ortho = false;

        if (!ortho) {
            // projection
            var aspect = this.wide * this.viewport[2] / this.viewport[3];
            //var dx = 3*(Math.random()-0.5)/this.viewport[2];
            //var dy = 3*(Math.random()-0.5)/this.viewport[3];
            my_perspective(this.proj, this.fov * QWQ.RAD_PER_DEG, aspect, this.near, this.far);
        } else {
            var z = ortho;
            mat4.ortho(this.proj, -z, z, -z, z, -this.far, -this.near);
        }

        // modulate pos
        //vec3.normalize(F, dir);
        //vec3.cross(R, F, up);
        //vec3.cross(U, F, R);

        // view
        vec3.add(ref, pos, dir);
        //vec3.scaleAndAdd(ref, pos, F, 1);

        // https://en.wikibooks.org/wiki/OpenGL_Programming/Depth_of_Field
        //var theta = Math.random() * Math.PI * 2;
        //theta += 0.7;
        //var aperture = 0.001;
        //vec3.scaleAndAdd(P, pos, R, aperture * Math.cos(theta));
        //vec3.scaleAndAdd(P, P, U, aperture * Math.sin(theta));
        vec3.copy(P, pos);

        mat4.lookAt(this.view, P, ref, up);
        
        //mat4.rotateY(this.view, this.view, 0.002*(Math.random()-0.5));
        //mat4.rotateX(this.view, this.view, 0.002*(Math.random()-0.5));

        // billboard
        var b = this.bill;
        var v = this.view;
        b[0] = v[0]; b[1] = v[4]; b[2] = v[8];
        b[3] = v[1]; b[4] = v[5]; b[5] = v[9];
        b[6] = v[2]; b[7] = v[6]; b[8] = v[10];

        // combined
        mat4.multiply(this.mvp, this.proj, this.view);
        mat4.invert(this.inv_mvp, this.mvp);
        mat4.invert(this.inv_view, this.view);
        mat4.invert(this.inv_proj, this.proj);

        // XXX could be just pos/dir?
        vec3.transformMat4(this.view_pos, [0, 0, 0], this.inv_view);
        vec3.set(this.view_dir, -this.inv_view[8], -this.inv_view[9], -this.inv_view[10]);
    };

    Camera.prototype.update_quat = function(pos, rot) {
        // projection
        var aspect = this.viewport[2] / this.viewport[3];
        my_perspective(this.proj, this.fov * QWQ.RAD_PER_DEG, aspect, this.near, this.far);

        // create a view matrix with a look-at
        mat4.fromRotationTranslation(this.view, rot, pos);
        mat4.invert(this.view, this.view);

        // billboard
        var b = this.bill;
        var v = this.view;
        b[0] = v[0]; b[1] = v[4]; b[2] = v[8];
        b[3] = v[1]; b[4] = v[5]; b[5] = v[9];
        b[6] = v[2]; b[7] = v[6]; b[8] = v[10];

        // combined
        mat4.multiply(this.mvp, this.proj, this.view);
        mat4.invert(this.inv_mvp, this.mvp);
        mat4.invert(this.inv_view, this.view);

        // XXX could be just pos/dir?
        vec3.transformMat4(this.view_pos, [0, 0, 0], this.inv_view);
        vec3.set(this.view_dir, -this.inv_view[8], -this.inv_view[9], -this.inv_view[10]);
    };

    Camera.prototype.update_mat = function(mat) {
        // projection
        var aspect = this.viewport[2] / this.viewport[3];
        my_perspective(this.proj, this.fov * QWQ.RAD_PER_DEG, aspect, this.near, this.far);

        // create a view matrix with a look-at
        //mat4.fromRotationTranslation(this.view, rot, pos);
        mat4.invert(this.view, mat);

        // billboard
        var b = this.bill;
        var v = this.view;
        b[0] = v[0]; b[1] = v[4]; b[2] = v[8];
        b[3] = v[1]; b[4] = v[5]; b[5] = v[9];
        b[6] = v[2]; b[7] = v[6]; b[8] = v[10];

        // combined
        mat4.multiply(this.mvp, this.proj, this.view);
        mat4.invert(this.inv_mvp, this.mvp);
        mat4.invert(this.inv_view, this.view);

        // XXX could be just pos/dir?
        vec3.transformMat4(this.view_pos, [0, 0, 0], this.inv_view);
        vec3.set(this.view_dir, -this.inv_view[8], -this.inv_view[9], -this.inv_view[10]);
    };


    var tmp4 = vec4.create();

    Camera.prototype.unproject = function(out, win) {
        var v = tmp4;
        v[0] = 2 * (win[0] / this.viewport[2]) - 1;
        v[1] = 2 * (win[1] / this.viewport[3]) - 1;
        v[1] = 1 - v[1];
        v[2] = 0;
        v[3] = 1;

        vec4.transformMat4(v, v, this.mvpInv);
        out[0] = v[0] / v[3];
        out[1] = v[1] / v[3];
    };

    this.Camera = Camera;
    return this;

}).call(webgl || {});
