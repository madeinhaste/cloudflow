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
        ],
        sources: [
            'shaders/default.glsl',
            'shaders/shoe.glsl',
            'shaders/shoe_pick.glsl',
            'shaders/tunnel.glsl',
        ]
    });


    canvas.show_grid = false;
    canvas.time = 0;

    canvas.orbit.distance = 500;
    canvas.camera.fov = 25;
    canvas.camera.far = 800;
    vec4.set(canvas.clear_color, 0, 0, 0, 0);
    vec3.set(canvas.orbit.rotate, 0, 0, 0);
    var target_orbit_distance = 25;

    var shoe = cloudflow_init_shoe();
    var shoe_rot = vec2.create();
    var shoe_trans = vec3.create();

    var rumble = vec2.create();
    var rumble_start_time = 0;

    function fbm(x, y, n) {
        var w = 1;
        var s = 0.0;
        while (n-- > 0) {
            s += w * noise.perlin2(x, y);
            x *= 2.0;
            y *= 2.0;
            w *= 0.5;
        }
        return s;
    }

    var draw_funworld;

    function update_shoe(env) {
        var cw = env.el.width;
        var ch = env.el.height;

        var Q = 3;
        var rx = ((env.mouse.pos[1] / ch) - 0.5) * Q;
        var ry = ((env.mouse.pos[0] / cw) - 0.5) * Q;
        var k = 0.1;
        shoe_rot[0] = lerp(shoe_rot[0], rx, k);
        shoe_rot[1] = lerp(shoe_rot[1], ry, k);

        if (shoe.rumble) {
            shoe.rumble_amount = 1.0;
        } else {
            shoe.rumble_amount = Math.max(0.0, shoe.rumble_amount - 0.015);
        }

        draw_funworld = false;

        //var t = 0.01 * time;
        if (shoe.rumble_amount > 0.0) {
            var t = (canvas.time - rumble_start_time)/1000;
            var duration = 2.0;
            var post_duration = 0.35;

            if (t > duration + post_duration) {
                draw_funworld = true;
            } else if (t > duration) {
                var u = t - duration;

                shoe_trans[2] += 10.5 * u;
                shoe_trans[1] += 0.9 * u;
                shoe_trans[0] -= 2.0 * u;

                rumble[0] += 0.35;
                rumble[1] += 0.12;
            } else {
                var u = Math.min(1, t/duration);
                u = Math.pow(u, 0.25);

                var freq = lerp(0, 7, u);
                var amp = u*u * QWQ.RAD_PER_DEG * 25;
                var tt = freq * t;

                var A = Math.pow(shoe.rumble_amount, 2.0);

                amp *= A;

                rumble[0] = amp * fbm(tt, 0.1, 2);
                rumble[1] = amp * fbm(tt, 0.3, 2);

                var amp2 = u * QWQ.RAD_PER_DEG * 15;
                amp2 *= A;

                rumble[0] += amp2 * Math.cos(5 * t);
                rumble[1] += amp2 * Math.sin(5 * t);

                shoe_trans[1] = 1.5 * amp2 * fbm(0.5*tt, 0.4, 2);
            }

        }
        
        if (!shoe.rumble) {
            var damp = 0.98;
            rumble[0] *= damp;
            rumble[1] *= damp;
            vec3.scale(shoe_trans, shoe_trans, 0.50);
        }

        mat4.identity(shoe.mat);
        mat4.translate(shoe.mat, shoe.mat, shoe_trans);
        mat4.rotateX(shoe.mat, shoe.mat, rumble[0] - shoe_rot[0]);
        mat4.rotateY(shoe.mat, shoe.mat, rumble[1] - shoe_rot[1]);
    }

    var tunnel = new Tunnel;

    var experience_visible = false;
    function set_experience_visible(b) {
        if (b == experience_visible)
            return;

        experience_visible = b;
        api.on_experience(b);
    }

    var hover_part = -1;
    function set_hover_part() {
        var part = shoe.selected_part_index;
        if (part == hover_part)
            return;

        hover_part = shoe.selected_part_index;
        api.on_hover(hover_part);
    }


    canvas.draw = function() {
        if (!visible)
            return;

        //tunnel.update(this);
        //tunnel.draw(this);
        //return;

        if (1) {
            if (draw_funworld && shoe.rumble) {
                set_experience_visible(true);
                tunnel.update(this, this.camera);
                tunnel.draw(this);
            } else {
                set_experience_visible(false);
                api.on_rumble(vec2.length(rumble));
                update_shoe(this);
                shoe.draw(this);
            }
        }
    };

    canvas.pick = function() {
        if (!draw_funworld) {
            shoe.pick(this);
            set_hover_part();
        }
    };

    document.addEventListener('mousedown', function(e) {
        if (shoe.selected_part_id >= 0) {
            shoe.rumble = true;
            rumble_start_time = canvas.time;
        }
    }, false);

    document.addEventListener('mouseup', function(e) {
        if (!shoe.rumble)
            return;

        shoe.rumble = false;

        if (canvas.time - rumble_start_time > 2000) {
            canvas.orbit.distance = 500;
            vec2.set(shoe_rot, 0, 0);
            vec2.set(shoe_trans, 0, 0);
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

        if (1 && shoe.ob)
            canvas.orbit.distance = lerp(canvas.orbit.distance, target_orbit_distance, 0.003*dt);

        requestAnimationFrame(animate);

        if (1) {
            shoe.update(dt);
            var result = canvas._pick();
            if (result !== undefined) {
                var id = result;
                shoe.selected_part_id = id;
                //$('#debug').text(''+id);
            }
        }

        canvas._draw();
    }
    animate(0);

    var visible = true;

    var api = {
        set_visible: function(v) {
            visible = v;
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
