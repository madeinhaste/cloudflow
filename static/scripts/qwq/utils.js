var QWQ = (function() {

    _.assign(this, {

        // some constants
        PI: Math.PI,
        HALF_PI: Math.PI/2,
        TWO_PI: 2*Math.PI,
        DEG_PER_RAD: 180/Math.PI,
        RAD_PER_DEG: Math.PI/180,

        // simple math functions
        lerp: function(a, b, x) {
            return (1 - x) * a + x * b;
        },

        fract: function(x) {
            var xi = Math.floor(x);
            var xf = x - xi;
            return xf;
        },

        clamp: function(x, a, b) {
            if (x < a) return a;
            else if (x > b) return b;
            else return x;
        },

        smoothstep: function(x) {
            return 3 * x * x - 2 * x * x * x;
        },

        modulo: function(x, y) {
            return ((x % y) + y) % y;
        },

        sign: function(x) {
            if (x < 0) return -1;
            else if (x > 0) return 1;
            else return 0;
        },

        random: (function() {
            var gauss_next = 0;
            var random = Math.random;

            return {
                random: Math.random,

                // XXX _.random(n)
                cardinal: function(n) {
                    return Math.floor(n * this.random());
                },

                // XXX _.random(lb, ub)
                integer: function(lb, ub) {
                    return lb + Math.floor((ub - lb) * this.random());
                },

                uniform: function(lb, ub) {
                    return QWQ.lerp(lb, ub, this.random());
                },

                gauss: function(mu, sigma) {
                    var z = gauss_next;
                    gauss_next = 0;
                    if (z === 0) {
                        var x2pi = QWQ.TWO_PI * this.random();
                        var g2rad = Math.sqrt(-2 * Math.log(1 - this.random()));
                        z = Math.cos(x2pi) * g2rad;
                        _gaussNext = Math.sin(x2pi) * g2rad;
                    }
                    
                    return mu + z*sigma
                },

                expovariate: function(lambda) {
                    return -Math.log(1.0 - this.random()) / lambda;
                },

                // XXX _.sample
                choose: function(arr) {
                    var i = Random.cardinal(arr.length);
                    return arr[i];
                },

                uniform_vec3: function(vec, scale) {
                    vec[0] = scale * 2*(this.random() - 0.5);
                    vec[1] = scale * 2*(this.random() - 0.5);
                    vec[2] = scale * 2*(this.random() - 0.5);
                    return vec;
                },

                unit_vec3: function(vec) {
                    this.uniform_vec3(vec, 1);
                    vec3.normalize(vec, vec);
                    return vec;
                },

                shuffle: function(arr) {
                    for (var i = arr.length-1; i >= 0; --i) {
                        var j = this.cardinal(i + 1);
                        var tmp = arr[i];
                        arr[i] = arr[j];
                        arr[j] = tmp;
                    }
                },

                distribute: function(a, b, exp) {
                    return QWQ.lerp(a, b, Math.pow(this.random(), exp));
                },

                // true/false based on probability - for decisions
                chance: function(mu) {
                    return this.random() < mu;
                },
            };
        })(),

        save_file_as: function(data, filename, type) {
            type = type || 'application/octet-binary';
            var blob = new Blob([ data ], { type: type });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.click();
            URL.revokeObjectURL(blob);
        },

        // Firefox layerX / WebKit offsetX
        // XXX incorporate scroll wheel stuff here?
        get_event_offset: function(out, e) {
            if (e.originalEvent) e = e.originalEvent;
            if (typeof e.offsetX == 'undefined') {
                out[0] = e.layerX;
                out[1] = e.layerY;
            } else {
                out[0] = e.offsetX;
                out[1] = e.offsetY;
            }
        },

        each_line: function(text, callback) {
            var sp = 0;
            var lineno = 0;
            while (sp < text.length) {
                var ep = text.indexOf('\n', sp);
                if (ep == -1)
                    ep = text.length;

                var line = text.substr(sp, ep - sp);
                sp = ep + 1;

                callback(line, lineno++);
            }
        },

        // precision timing
        get_time: (function() {
            if (window.performance && performance.now) {
                return function() {
                    return 0.001 * performance.now();
                };
            } else {
                return function() {
                    return 0.001*Date.now();
                };
            }
        })(),

        base64_decode: function(src, type) {
            var raw = atob(src);
            var len = raw.length;
            var buf = new ArrayBuffer(len);
            var dst = new Uint8Array(buf);
            for (var i = 0; i < len; ++i) 
                dst[i] = raw.charCodeAt(i);

            return type ? new type(buf) : buf;
        },

        base64_encode: function(src) {
            if (src instanceof ArrayBuffer)
                src = new Uint8Array(src);
            else
                src = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);

            var len = src.length;
            var dst = '';
            for (var i = 0; i < len; ++i)
                dst += String.fromCharCode(src[i]);

            return btoa(dst);
        },

        color: (function() {

            function is_array(x) {
                return _.isArray(x) || (x instanceof Float32Array);
            }

            // some color functions:
            // https://gist.github.com/mjijackson/5311256

            function hue2rgb(p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            }

            var template_rgb = _.template('rgb(${r},${g},${b})');

            return {
                rgb_to_css: function(r, g, b) {
                    if (is_array(r)) {
                        g = r[1];
                        b = r[2];
                        r = r[0];
                    }

                    var o = {
                        r: ~~(255.9999 * r),
                        g: ~~(255.9999 * g),
                        b: ~~(255.9999 * b),
                    };

                    return template_rgb(o);
                },

                rgb_to_hsl: function(out, r, g, b) {
                    if (is_array(r)) {
                        g = r[1];
                        b = r[2];
                        r = r[0];
                    }
             
                    var max = Math.max(r, g, b);
                    var min = Math.min(r, g, b);
                    var h, s, l = (max + min) / 2;
                     
                    if (max == min) {
                        h = s = 0; // achromatic
                    } else {
                        var d = max - min;
                        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                     
                        switch (max) {
                            case r:
                                h = (g - b) / d + (g < b ? 6 : 0);
                                break;
                            case g:
                                h = (b - r) / d + 2;
                                break;
                            case b:
                                h = (r - g) / d + 4;
                                break;
                        }
                     
                        h /= 6;
                    }
                     
                    out[0] = h;
                    out[1] = s;
                    out[2] = l;
                    return out;
                },

                hsl_to_rgb: function(out, h, s, l) {
                    if (is_array(h)) {
                        s = h[1];
                        l = h[2];
                        h = h[0];
                    }

                    var r, g, b;

                    if (s == 0) {
                        // achromatic
                        r = g = b = l;
                    } else {
                        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                        var p = 2 * l - q;
                        r = hue2rgb(p, q, h + 1/3);
                        g = hue2rgb(p, q, h);
                        b = hue2rgb(p, q, h - 1/3);
                    }

                    out[0] = r;
                    out[1] = g;
                    out[2] = b;
                    return out;
                },

                hex_to_rgb: function(out, s) {
                    if (s[0] == '#')
                        s = s.substr(1);
                    function parse_byte(idx) {
                        var b = s.substr(2*idx, 2);
                        return parseInt(b, 16)/255;
                    }

                    var r = parse_byte(0);
                    var g = parse_byte(1);
                    var b = parse_byte(2);

                    out[0] = r;
                    out[1] = g;
                    out[2] = b;

                    return out;
                }
            }

        })(),

    });

    // pub-sub via jQuery
    // https://gist.github.com/cowboy/661855
    // beware: first argument of receiver will be an event
    var $this = $(this);
    _.assign(this, {
        subscribe: function() { $this.on.apply($this, arguments) },
        unsubscribe: function() { $this.off.apply($this, arguments) },
        publish: function() { $this.trigger.apply($this, arguments) },
    });

    function FPS(el) {
        if (typeof el == 'string')
            el = document.querySelector(el);

        this.t0 = 0;
        this.el = el;
        this.elapsed_avg = 0;
        this.dpr = 1.0;
        this.fxaa = true;
        this.reset();
    }

    FPS.prototype.reset = function() {
        this.t0 = performance.now();
    };

    FPS.prototype.update = function() {
        var t1 = performance.now();
        var elapsed = t1 - this.t0;
        this.elapsed_avg = QWQ.lerp(this.elapsed_avg, elapsed, 0.1);
        this.t0 = t1;

        var text = Math.round(1000/this.elapsed_avg);
        if (this.dpr != 1.0)
            text += ' x'+this.dpr;

        if (this.fxaa)
            text += ' fxaa';

        this.el.innerHTML = text;
    };

    this.FPS = FPS;

    return this;

}).call(QWQ || {});

// requestAnimationFrame shim
if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function(callback) { setTimeout(callback, 1000/60) });
}
