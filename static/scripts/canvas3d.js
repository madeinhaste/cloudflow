var Orbit = (function() {

    function Orbit(ry, rx, distance) {
        ry = ry || 0.0;
        rx = rx || 0.0;
        distance = distance || 10.0;
        this.rotate = vec3.fromValues(ry, rx, 0.0);
        this.translate = vec3.fromValues(0, 0, 0);
        this.distance = distance;

        this.pos = vec3.create();
        this.dir = vec3.create();
        this.up = vec3.fromValues(0, 1, 0);
    }

    var Q = quat.create();
    var T = vec3.create();

    Orbit.prototype.copy = function(other) {
        vec3.copy(this.rotate, other.rotate);
        vec3.copy(this.translate, other.translate);
        this.distance = other.distance;
        this.update();
    };

    Orbit.prototype.set_focal_point = function(pos) {
        vec3.copy(this.translate, pos);
    };

    Orbit.prototype.pan = function(dx, dy) {
        quat.identity(Q);
        quat.rotateY(Q, Q, this.rotate[0]);
        quat.rotateX(Q, Q, this.rotate[1]);

        vec3.set(T, dx, dy, 0);
        vec3.transformQuat(T, T, Q);
        vec3.add(this.translate, this.translate, T);
    };

    Orbit.prototype.tumble = function(ry, rx) {
        this.rotate[0] += ry;
        this.rotate[1] += rx;
    };

    var min_distance = 0.001;

    Orbit.prototype.dolly = function(dz) {
        this.distance = Math.max(min_distance, this.distance + dz);
    };

    Orbit.prototype.zoom = function(sz) {
        this.distance = Math.max(min_distance, this.distance * sz);
    };

    Orbit.prototype.update = function() {
        quat.identity(Q);
        quat.rotateY(Q, Q, this.rotate[0]);
        quat.rotateX(Q, Q, this.rotate[1]);

        //vec3.transformQuat(this.pos, this.translate, Q);
        vec3.set(this.dir, 0, 0, -1);
        vec3.transformQuat(this.dir, this.dir, Q);
        vec3.scaleAndAdd(this.pos, this.translate, this.dir, -this.distance);
    };

    Orbit.prototype.dump = function() {
        var r = this.rotate;
        var t = this.translate;
        var d = this.distance;

        var code = [ r[0], r[1], t[0], t[1], t[2], d ];
        return QWQ.base64_encode(new Float32Array(code));
    };

    Orbit.prototype.dump2 = function() {
        return {
            rotate: this.rotate,
            translate: this.translate,
            distance: this.distance
        };
    };

    Orbit.prototype.load2 = function(o) {
        vec3.copy(this.rotate, o.rotate);
        vec3.copy(this.translate, o.translate);
        this.distance = o.distance;
        this.update();
    };

    Orbit.prototype.load = function(value) {
        var c = QWQ.base64_decode(value, Float32Array);
        vec2.set(this.rotate, c[0], c[1]);
        vec3.set(this.translate, c[2], c[3], c[4]);
        this.distance = c[5];
        this.update();
    };

    return Orbit;

}());


var Canvas3D = (function() {

    // pluggable cameras & lights...

    function make_gl_matrix_temps(gl_matrix_type) {
        var N_TEMPS = 16;
        return _.times(N_TEMPS, gl_matrix_type.create);
    }

    var temps = {
        vec3: make_gl_matrix_temps(vec3),
        vec4: make_gl_matrix_temps(vec4),
        quat: make_gl_matrix_temps(quat),
        mat4: make_gl_matrix_temps(mat4),
    };

    function Canvas3D(opts) {
        var canvas = this.el = document.createElement('canvas');

        opts = opts || {};

        var sources = [ 'shaders/default.glsl' ];
        if (opts.sources) sources.push.apply(sources, opts.sources);

        window.gl = webgl.setup_canvas(canvas, {
            antialias: opts.antialias || false,
            extensions: opts.extensions || [],
            shaderSources: sources
        });
        
        console.assert(gl);
        if (!gl) return;

        this.draw = function() {};
        this.redraw_queued = false;

        this.init_input();

        this.camera = new webgl.Camera();
        this.camera.near = 0.1;
        this.camera.far = 100;

        this.orbit = new Orbit(0, -0.2, 10);
        this.clear = true;
        this.clear_color = vec4.fromValues(0, 0, 0, 1);

        // FIXME
        this.show_grid = true;
        this.draw_grid = (function() {

            var size = 21;
            var va = new webgl.VertexArray({ position: '2f' });
            var v = va.struct();
            for (var i = 0; i < size; ++i) {
                var x = QWQ.lerp(-1, 1, i/(size - 1));
                var y = 1;
                vec2.set(v.position,  x, -y); va.push(v);
                vec2.set(v.position,  x,  y); va.push(v);
                vec2.set(v.position, -y,  x); va.push(v);
                vec2.set(v.position,  y,  x); va.push(v);
            }

            var vertex_buffer = webgl.new_vertex_buffer(va.buffer);
            var vertex_count = va.length;
            var program = webgl.get_program('grid');
            var mvp = mat4.create();

            function draw() {
                if (!this.show_grid) return;

                gl.disable(gl.DEPTH_TEST);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                var pgm = program.use();

                //var scale = 0.1 * this.camera.far;
                var scale = 10.0;
                mat4.identity(mvp);
                mat4.scale(mvp, mvp, [scale, scale, scale]);
                mat4.multiply(mvp, this.camera.mvp, mvp);
                pgm.uniformMatrix4fv('mvp', mvp);

                webgl.bind_vertex_buffer(vertex_buffer);
                va.gl_attrib_pointer('position', pgm.enableVertexAttribArray('position'));

                var c0 = 0.75;
                var c1 = 0.25;

                pgm.uniform4f('color', 1, 1, 1, c1);
                gl.drawArrays(gl.LINES, 0, 4 * size);

                pgm.uniform4f('color', 1, 1, 1, c0);
                gl.drawArrays(gl.LINES, 4 * (size / 2), 2);
                gl.drawArrays(gl.LINES, (4 * (size / 2)) - 2, 2);

                gl.disable(gl.BLEND);
            }

            return draw;

        })();

        this.mouse = {
            pos: vec2.create(),
            delta: vec2.create(),
            button: -1
        };

        this.redraw();
        this.on_camera_moved = function() {};
        this.on_click = function() {};
        this.freeze_camera = false;
    }

    Canvas3D.prototype.update_mouse = function(e) {
        var curr_pos = temps.vec3[0];
        QWQ.get_event_offset(curr_pos, e);    // FIXME

        var mouse = this.mouse;
        vec2.sub(mouse.delta, curr_pos, mouse.pos);
        vec2.copy(mouse.pos, curr_pos);

        //this.update_pick_ray();
    };

    Canvas3D.prototype.init_input = function() {
        var self = this;
        var el = this.el;
        var mouse = this.mouse;

        function set_cursor(name) {
            name = name || 'default';
            el.style.cursor = name;
        }

        function add_event_listeners() {
            //el.addEventListener('mousemove', mousemove);
            document.addEventListener('mouseup', mouseup);
            document.addEventListener('mousewheel', mousewheel);
        }

        function remove_event_listeners() {
            //el.removeEventListener('mousemove', mousemove);
            document.removeEventListener('mouseup', mouseup);
            document.removeEventListener('mousewheel', mousewheel);
        }

        document.addEventListener('mousemove', mousemove);

        function mousedown(e) {
            self.update_mouse(e);
            self.mouse.button = e.button;

            self.on_click && self.on_click(e);

            set_cursor('move');
            add_event_listeners();

            // this stops selecting things!
            e.preventDefault();
        }

        function mousemove(e) {
            self.update_mouse(e);

            var mouse = self.mouse;
            var orbit = self.orbit;
            var camera = self.camera;

            var dscale = 0.002;
            var tscale = -0.0010;

            if (mouse.button < 0)
                return;

            if (mouse.button === 0) {
                if (e.ctrlKey)  {
                    var dx = mouse.delta[0];
                    var dy = mouse.delta[1];
                    var d = (Math.abs(dx) > Math.abs(dy)) ? dx : -dy;
                    orbit.dolly(d * 0.020);
                } else if (e.shiftKey) {
                    orbit.pan(-dscale * mouse.delta[0], dscale * mouse.delta[1]);
                } else {
                    orbit.tumble(tscale * mouse.delta[0], tscale * mouse.delta[1]);
                }

                self.on_camera_moved();
            }

            if (mouse.button === 1) {
                orbit.pan(-dscale * mouse.delta[0], dscale * mouse.delta[1]);
                self.on_camera_moved();
            }

            if (mouse.button === 2) {
                var dx = mouse.delta[0];
                var dy = mouse.delta[1];
                var d = (Math.abs(dx) > Math.abs(dy)) ? -dx : dy;
                orbit.dolly(2 * dscale * d);
                self.on_camera_moved();
            }

            self.redraw();
        }

        function mouseup(e) {
            if (self.mouse.button >= 0) {
                set_cursor();
                remove_event_listeners();
                self.mouse.button = -1;
            }

            self.redraw();
        }

        function mousewheel(e) {
            var dy = e.wheelDelta / 120;
            self.orbit.zoom((dy < 0) ? 0.90 : 1.1);
            self.redraw();
            self.on_camera_moved();
            return false;
        }

        el.addEventListener('mousedown', mousedown);
        el.addEventListener('mousewheel', mousewheel);

        // disable menu on right click
        el.addEventListener('contextmenu', function(e) { e.preventDefault() });
    };

    Canvas3D.prototype.redraw = function() {
        var self = this;

        if (!this.redraw_queued) {
            this.redraw_queued = true;
            requestAnimationFrame(function() { 
                self._pick();
                self._draw();
                self.redraw_queued = false;
            });
        }
    };

    Canvas3D.prototype.check_resize = function() {
        var canvas = this.el;
        var camera = this.camera;

        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
            vec4.copy(camera.viewport, gl.getParameter(gl.VIEWPORT));
        }
    };

    Canvas3D.prototype.reset_camera = function() {
        // TODO
        this.redraw();
    };

    // this is being updated before a draw... maybe better after a camera modification
    Canvas3D.prototype.update_camera = function() {
        if (!this.freeze_camera) {
            this.orbit.update();
            this.camera.update(this.orbit.pos, this.orbit.dir);
        }
    };

    Canvas3D.prototype._draw = function() {
        this.check_resize();
        this.update_camera();

        // clear, camera, grid...
        if (this.clear) {
            var c = this.clear_color;
            gl.clearColor(c[0], c[1], c[2], c[3]);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }

        this.draw_grid();

        // draw the thing
        this.draw();
    };

    // PICKING FRAMEBUFFER SETUP
    var mvp_pick = mat4.create();
    var pick_size = 4;
    var pick_pixels = new Uint8Array((pick_size*pick_size) << 2);

    var get_pick_framebuffer = (function() {
        var fb = null;
        var tex_color = null;
        var rb_depth = null;

        function create_pick_framebuffer() {
            fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

            var tex_color = webgl.new_texture({ size: pick_size });
            gl.bindTexture(gl.TEXTURE_2D, tex_color);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex_color, 0);

            var rb_depth = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, rb_depth);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, pick_size, pick_size);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb_depth);
            gl.bindRenderbuffer(gl.RENDERBUFFER, null);

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        return function() {
            if (!fb) create_pick_framebuffer();
            return fb;
        };
    })();

    Canvas3D.prototype._pick = function() {
        if (!this._pick_request)
            return;

        this.update_camera();

        // setup viewport & projection matrix
        var vp = this.camera.viewport;
        var mvp = mvp_pick;
        var camera_mvp = this.camera.mvp;
        var dx = pick_size;
        var dy = pick_size;
        var mx = this._pick_request.x;
        var my = this._pick_request.y;

        mat4.identity(mvp);
        mat4.translate(mvp, mvp, [ (vp[2] - 2*(mx - vp[0])) / dx, -(vp[3] - 2*(my - vp[1])) / dy, 0]);
        mat4.scale(mvp, mvp, [vp[2]/dx, vp[3]/dy, 1]);
        mat4.multiply(mvp, mvp, camera_mvp);

        // FIXME inv_mvp etc??
        this.camera.mvp = mvp;

        var fb = get_pick_framebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

        gl.viewport(0, 0, pick_size, pick_size);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // call the picking renderer
        this.pick();

        // read back pixels
        gl.readPixels(0, 0, pick_size, pick_size, gl.RGBA, gl.UNSIGNED_BYTE, pick_pixels);

        // reset drawing state
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(vp[0], vp[1], vp[2], vp[3]);
        this.camera.mvp = camera_mvp;

        // now find the most frequent id
        var best_id = -1;
        var best_count = 0;
        var counts = {};
        for (var i = 0; i < pick_pixels.length; i += 4) {
            // alpha test
            if (!pick_pixels[i + 3]) continue;

            // object id from rgb
            var id = (pick_pixels[i + 0] | (pick_pixels[i + 1] << 8) | (pick_pixels[i + 2] << 16));
            var count = counts[id] || 0;
            counts[id] = ++count;

            if (count > best_count) {
                best_id = id;
                best_count = count;
            }
        }

        var callback = this._pick_request.callback;
        this._pick_request = null;

        if (callback)
            callback(best_id);
    };

    Canvas3D.prototype.request_pick = function(x, y, callback) {
        this._pick_request = {
            x: x,
            y: y,
            callback: callback
        };
        // FIXME don't need to redraw the entire scene on pick
        // flag pick vs draw request
        this.redraw();
    };

    return Canvas3D;

}());

