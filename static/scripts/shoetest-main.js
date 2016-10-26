var USE_TEXLOD_FIX = false;

function main() {
    var canvas = new Canvas3D({
        antialias: true,
        extensions: [
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
        ],
        sources: [
            'shaders/default.glsl',
            'shaders/shoe2.glsl',
            'shaders/shoe_pick2.glsl',
            'shaders/fxaa.glsl',
            'shaders/cube.glsl',
        ]
    });
    canvas.mouse_camera = false;

    $('#main').prepend(canvas.el);

    var use_player_cam = false;
    var use_wireframe = false;
    key('space', function() { use_player_cam = !use_player_cam });

    var shoe = cloudflow_init_shoe_v3_ren();
    var fps = new QWQ.FPS('#debug');

    //$('#debug').text('DPR: ' + window.devicePixelRatio);

    var ren_env = {
        camera: canvas.camera,
        cw: canvas.el.width,
        ch: canvas.el.height,
        time: 0,
        mat: mat4.create(),
        rumble_amount: 0,
        selected_part_index: 0,
        part_select: new Float32Array(4),
        enable_fxaa: true,
        use_normal2: true,
        red: false,
        grid: false
    };

    key('f', function() {
        ren_env.enable_fxaa = !ren_env.enable_fxaa;
    });

    key('c', function() {
        ren_env.red = !ren_env.red;
    });

    key('g', function() {
        ren_env.grid = !ren_env.grid;
    });

    $('#fxaa').on('click', function() {
        ren_env.enable_fxaa = !ren_env.enable_fxaa;
        var v = ren_env.enable_fxaa ? 'On' : 'Off';
        $(this).text(`FXAA (${v})`);
    });

    canvas.draw = function() {
        if (shoe && shoe.ready()) {
            ren_env.cw = canvas.el.width;
            ren_env.ch = canvas.el.height;
            shoe.draw(ren_env);
        }
        fps.update();
    };

    canvas.pick = function() {
    };

    function get_event_pos(out, e) {
        var rect = e.target.getBoundingClientRect();
        if (typeof e.pageX == 'undefined') {
            e = (e.originalEvent.targetTouches[0] ||
                 e.originalEvent.changedTouches[0]);
        }

        if (!e) {
            out[0] = 0;
            out[1] = 0;
            return;
        }

        out[0] = e.pageX - rect.left;
        out[1] = e.pageY - rect.top;
    }

    var $canvas = $(canvas.el);

    var mouse = {
        start: vec2.create(),
        last: vec2.create(),
        curr: vec2.create(),
        delta: vec2.create(),
        button: -1,
        touches: 0,

        down: function(e) {
            get_event_pos(this.start, e);
            vec2.copy(this.curr, this.start);
            vec2.copy(this.last, this.curr);
            vec2.sub(this.delta, this.curr, this.last);

            if (e.button === undefined) {
                // touches
                var n = e.originalEvent.targetTouches.length;
                this.button = { 1: 0, 2: 2, 3: 1 }[n];
                this.touches = n;
            } else {
                this.button = e.button;
                this.touches = 0;
            }
        },

        move: function(e) {
            vec2.copy(this.last, this.curr);
            get_event_pos(this.curr, e);
            vec2.sub(this.delta, this.curr, this.last);
        },

        up: function(e) {
            vec2.copy(this.last, this.curr);
            get_event_pos(this.curr, e);
            vec2.sub(this.delta, this.curr, this.last);
            this.button = -1;
        },
        
        drag: false
    };

    $canvas.on('contextmenu', function(e) {
        // disable right click menu
        e.preventDefault()
    });

    $canvas.on('mousedown touchstart', function(e) {
        mouse.down(e);
        mouse.drag = true;
        e.preventDefault();
    });

    $canvas.on('mousemove touchmove', function(e) {
        if (!mouse.drag)
            return;

        mouse.move(e);

        var orbit = canvas.orbit;
        var camera = canvas.camera;
        var dscale = 0.002;
        var tscale = -0.0010;

        if (mouse.touches) {
            dscale = 0.01;
            tscale = -0.002;
        }

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
        }

        else if (mouse.button === 1) {
            orbit.pan(-dscale * mouse.delta[0], dscale * mouse.delta[1]);
        }

        else if (mouse.button === 2) {
            var dx = mouse.delta[0];
            var dy = mouse.delta[1];
            var d = (Math.abs(dx) > Math.abs(dy)) ? -dx : dy;
            orbit.dolly(2 * dscale * d);
        }
    });

    $canvas.on('mouseup touchend', function(e) {
        if (!mouse.drag)
            return;

        mouse.drag = false;
        mouse.up(e);

        // click detect
    /*
        var len = vec2.dist(mouse_first, mouse_last);
        if (len < 5) {
            do_click(mouse_last[0], mouse_last[1]);
        }
        */
    });


    function animate(t) {
        requestAnimationFrame(animate);
        canvas._draw();
    }
    animate(0);

}

$(main);
