var USE_TEXLOD_FIX = false;

function cloudflow_main(canvas) {

    var lerp = QWQ.lerp;

    var canvas = new Canvas3D({
        el: canvas,
        antialias: true,
        extensions: [
            'OES_element_index_uint',
            'OES_texture_half_float',
            'OES_texture_half_float_linear',
            'OES_texture_float',
            'OES_texture_float_linear',
            'OES_standard_derivatives',
            'WEBGL_compressed_texture_s3tc',
            'EXT_shader_texture_lod',
            'ANGLE_instanced_arrays'
        ],
        sources: [
            'shaders/default.glsl',
            'shaders/shoe.glsl',
            'shaders/shoe2.glsl',
            'shaders/shoe_pick.glsl',
            'shaders/tunnel.glsl',
            'shaders/cloud.glsl',
            'shaders/earth.glsl',
        ]
    });


    canvas.show_grid = false;
    canvas.time = 0;

    canvas.camera.fov = 25;
    canvas.camera.far = 800;
    vec4.set(canvas.clear_color, 0, 0, 0, 0);
    vec3.set(canvas.orbit.rotate, 0, 0, 0);
    var target_orbit_distance = 22;
    canvas.orbit.distance = 0;

    var shoe = cloudflow_init_shoe();

    canvas.draw_funworld = false;

    var tunnel = new Tunnel;
    var clouds = init_clouds();

    var experience_visible = 0;
    function set_experience_visible(idx) {
        if (idx == experience_visible)
            return;

        // 0: not visible => shoe
        // 1: mesh/clouds
        // 2: 

        if (idx) {
            sounds.enter_experience();
        } else {
            sounds.leave_experience();
        }

        sounds.ambient(idx);
        experience_visible = idx;
        api.on_experience(idx !== 0);
    }

    var hover_part = -1;
    function set_hover_part() {
        var part = shoe.selected_part_index;
        if (part == hover_part)
            return;

        hover_part = shoe.selected_part_index;
        api.on_hover(hover_part);

        if (hover_part >= 0)
            sounds.rollover(hover_part);
    }


    canvas.draw = function() {
        if (!visible)
            return;

        if (1) {
            if (this.draw_funworld && shoe.rumble) {
                set_experience_visible(hover_part + 1);

                if (hover_part == 0) {
                    tunnel.update(this);
                    tunnel.draw(this);
                } else if (hover_part == 1) {
                    clouds.update(this);
                    clouds.draw(this);
                }

                // make sure alpha channel is opaque
                // TODO take another look once we have a real background 
                gl.colorMask(false, false, false, true);
                gl.clearColor(0, 0, 0, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.colorMask(true, true, true, true);
            } else {
                set_experience_visible(0);
                api.on_rumble(vec2.length(shoe.rumble2));
                shoe.draw(this);

                if (shoe.rumble) {
                    //var charge = Math.max(0, vec2.length(shoe.rumble2) - 0.1);
                    sounds.charge(1);
                } else {
                    sounds.charge(0);
                }
            }
        }
    };

    canvas.pick = function() {
        if (!this.draw_funworld) {
            shoe.pick(this);
            set_hover_part();
        }
    };

    document.addEventListener('mousedown', function(e) {
        shoe.start_rumble(canvas);
    }, false);

    document.addEventListener('mouseup', function(e) {
        if (!shoe.rumble)
            return;

        shoe.rumble = false;

        if (canvas.time - shoe.rumble_start_time > 2000) {
            canvas.orbit.distance = 500;
            vec2.set(shoe.rot, 0, 0);
            vec2.set(shoe.trans, 0, 0);
            vec2.set(canvas.orbit.rotate, 0, 0);
        }
    }, false);

    var last_time = 0;
    function animate(t) {
        canvas.time = t;
        var dt;
        if (!last_time) {
            last_time = t;
            dt = 0;
        } else {
            var dt = t - last_time;
            last_time = t;
        }

        if (shoe.ready())
            canvas.orbit.distance = lerp(canvas.orbit.distance, target_orbit_distance, 0.003*dt);

        requestAnimationFrame(animate);

        if (1) {
            shoe.update(canvas, dt);
            var result = canvas._pick();
            if (result !== undefined) {
                shoe.set_picked_id(result);
            }
        }

        canvas._draw();
    }
    animate(0);
    var visible = true;

    var api = {
        set_visible: function(v) {
            visible = v;
            sounds.ambient(0);
        },

        reset: function() {
            canvas.orbit.distance = 500;
            //vec2.set(shoe_rot, Math.random() - 0.5, Math.random() - 0.5);
            //vec2.scale(shoe_rot, shoe_rot, 10.0);
        },

        on_hover: function(part) {},
        on_experience: function(b) {},
        on_rumble: function(v) {}
    };

    return api;
}
