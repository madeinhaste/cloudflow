var Canvas3D_v2 = (function() {

    function get_event_pos(out, e) {
        var rect = e.target.getBoundingClientRect();

        if (typeof e.pageX == 'undefined')
            e = e.targetTouches[0] || e.changedTouches[0];

        if (!e) {
            out[0] = 0;
            out[1] = 0;
            return;
        }

        out[0] = e.pageX - rect.left;
        out[1] = e.pageY - rect.top;
    }

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

    var extensions = [
        'OES_element_index_uint',
        'OES_texture_half_float',
        'OES_texture_half_float_linear',
        'OES_texture_float',
        'OES_texture_float_linear',
        'OES_standard_derivatives',
        'WEBGL_compressed_texture_s3tc',
        'WEBKIT_WEBGL_compressed_texture_pvrtc',
        'EXT_shader_texture_lod',
        'ANGLE_instanced_arrays'
    ];

    function Canvas3D(opts) {
        opts = opts || {};

        var canvas = this.el = (opts.el || document.createElement('canvas'));

        var sources;
        if (window.cloudflow_shaders)
            sources = window.cloudflow_shaders;
        else {
            sources = _.map(opts.shaders, function(s) {
                return 'shaders/' + s + '.glsl';
            });
            //console.log(sources);
        }

        window.gl = webgl.setup_canvas(canvas, {
            antialias: false,
            extensions: extensions,
            shaderSources: sources
        });
        
        console.assert(gl);
        if (!gl) return;

        this.draw = function() {};

        this.init_input();

        this.orbit = new Orbit(0, -0.2, 10);
        this.camera = new webgl.Camera();
        this.camera.near = 0.1;
        this.camera.far = 100;

        this.clear = true;
        this.clear_color = vec4.fromValues(0, 0, 0, 1);

        this.mouse = {
            pos: vec2.create(),
            pos_nd: vec2.create(),
            delta: vec2.create(),
            delta_nd: vec2.create(),
            button: -1
        };

        this.on_camera_moved = function() {};
        this.on_click = function() {};
        this.freeze_camera = false;
        this.pick_required = false;
        this.mouse_camera = true;

        this.retina = retina_detect(gl);
        this.dpr = window.devicePixelRatio;
        //this.dpr = 1.5;

        this.interaction_mode = 'touch';
    }

    Canvas3D.prototype.update_mouse = function(e) {
        var curr_pos = temps.vec3[0];
        get_event_pos(curr_pos, e);

        //QWQ.get_event_offset(curr_pos, e);    // FIXME
        //debug.innerHTML = vec2.str(curr_pos);

        var mouse = this.mouse;
        vec2.sub(mouse.delta, curr_pos, mouse.pos);
        vec2.copy(mouse.pos, curr_pos);

        var dpr = this.retina ? this.dpr : 1;

        var cw = this.el.width / dpr;
        var ch = this.el.height / dpr;

        var ndx = mouse.pos_nd[0];
        var ndy = mouse.pos_nd[1];

        mouse.pos_nd[0] = 2 * (curr_pos[0]/cw - 0.5);
        mouse.pos_nd[1] = 2 * (curr_pos[1]/ch - 0.5);

        mouse.delta_nd[0] = ndx - mouse.pos_nd[0];
        mouse.delta_nd[1] = ndy - mouse.pos_nd[1];
    };

    Canvas3D.prototype.init_input = function() {
        var self = this;
        var el = this.el;
        var mouse = this.mouse;

        function mousedown(e) {
            self.interaction_mode = 'mouse';
            self.update_mouse(e);
            self.mouse.button = e.button;
            // this stops selecting things!
            e.preventDefault();
        }

        function mousemove(e) {
            self.interaction_mode = 'mouse';
            self.update_mouse(e);
            self.pick_required = true;
        }

        function mouseup(e) {
            self.interaction_mode = 'mouse';
            self.mouse.button = -1;
        }

        el.addEventListener('mousedown', mousedown);
        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);

        el.addEventListener('contextmenu', function(e) { e.preventDefault() });

        /////////////// TOUCH EVENTS /////////////

        el.addEventListener('touchstart', function(e) {
            self.interaction_mode = 'touch';
            self.pick_required = true;
            self.update_mouse(e);
            vec2.set(self.mouse.delta_nd, 0, 0);
            e.preventDefault();
        });

        el.addEventListener('touchmove', function(e) {
            self.interaction_mode = 'touch';
            self.update_mouse(e);
            e.preventDefault();
        });

        el.addEventListener('touchend', function(e) {
            self.interaction_mode = 'touch';
            self.update_mouse(e);
            vec2.set(self.mouse.delta_nd, 0, 0);
            e.preventDefault();
        });
    };

    Canvas3D.prototype.check_resize = function() {
        var canvas = this.el;
        var camera = this.camera;

        // change this to window.devicePixelRatio
        var dpr = this.retina ? this.dpr : 1;
        var target_width = Math.floor(dpr * canvas.clientWidth);
        var target_height = Math.floor(dpr * canvas.clientHeight);

        if (canvas.width !== target_width ||
            canvas.height !== target_height)
        {
            canvas.width = target_width;
            canvas.height = target_height;
            gl.viewport(0, 0, target_width, target_height);
            vec4.copy(camera.viewport, gl.getParameter(gl.VIEWPORT));
        }
    };

    Canvas3D.prototype.reset_camera = function() {
        // TODO
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
        if (!this.pick_required)
            return undefined;

        this.update_camera();

        // setup viewport & projection matrix
        var vp = this.camera.viewport;
        var mvp = mvp_pick;
        var camera_mvp = this.camera.mvp;
        var dx = pick_size;
        var dy = pick_size;

        var dpr = this.retina ? this.dpr : 1;
        var mx = dpr * this.mouse.pos[0];
        var my = dpr * this.mouse.pos[1];

        mat4.identity(mvp);
        mat4.translate(mvp, mvp, [
             (vp[2] - 2*(mx - vp[0])) / dx,
            -(vp[3] - 2*(my - vp[1])) / dy,
            0]);

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

        this.pick_required = false;
        return best_id;
    };

    return Canvas3D;

}());

