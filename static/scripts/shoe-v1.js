function cloudflow_init_shoe() {

    var lerp = QWQ.lerp;
    var clamp = QWQ.clamp;

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

    var shoe = {
        mat: mat4.create(),
        draw: draw,
        pick: pick,
        update: update,
        ready: function() {
            return ren.ready();
        },
        set_picked_id: set_picked_id,

        selected_part_index: -1,
        rumble: false,
        rumble_amount: 0,
        rumble_start_time: 0,
        rumble_fly_vec: vec3.create(),

        start_rumble: start_rumble,

        rot: vec3.create(),
        rot_neutral: vec3.create(),
        rot_vel: vec3.create(),

        trans: vec3.create(),
        rumble2: vec2.create(),
        part_select: new Float32Array(4),
        
        color: 0,
        
        toggle_fxaa: function() {
            return (ren_env.enable_fxaa = !ren_env.enable_fxaa);
        }
    };

    function update_part_selection(dt) {
        //var delta = dt * 0.0015;
        for (var i = 0; i < 4; ++i) {
            var curr = shoe.part_select[i];
            var next = curr;
            if (i == shoe.selected_part_index) {
                if (curr < 0.8) 
                    next = lerp(curr, 1.0, 0.1);
                else
                    next = lerp(curr, 1.0, 0.05);
            }
            else {
                next = lerp(curr, 0.0, 0.01);
            }

            next = clamp(next, 0, 1);
            shoe.part_select[i] = next;
        }
    }

    function update_shoe(env) {
        if (env.interaction_mode == 'mouse') {
            var rx = env.mouse.pos_nd[1];
            var ry = 1.5 * env.mouse.pos_nd[0];

            if (rx > -0.2) {
                var k = Math.min(1, (rx + 0.2) / 0.3);
                rx += QWQ.RAD_PER_DEG * k * 90;
            }

            //rx = ry = 0;
            var k = 0.1;

            shoe.rot[0] = lerp(shoe.rot[0], rx, k);
            shoe.rot[1] = lerp(shoe.rot[1], ry, k);
        }
        else if (env.interaction_mode == 'touch') {
            var rx = env.mouse.delta_nd[1];
            var ry = env.mouse.delta_nd[0];

            var k = 0.2;
            shoe.rot_vel[0] += k * rx;
            shoe.rot_vel[1] += k * ry;

            vec3.add(shoe.rot, shoe.rot, shoe.rot_vel);
            vec3.scale(shoe.rot_vel, shoe.rot_vel, 0.95);

        }

        if (shoe.rumble) {
            shoe.rumble_amount = 1.0;
        } else {
            shoe.rumble_amount = Math.max(0.0, shoe.rumble_amount - 0.015);
        }

        env.draw_funworld = false;

        if (shoe.rumble_amount > 0.0) {
            var t = (env.time - shoe.rumble_start_time)/1000;
            var duration = 1.0;
            var post_duration = 0.35;

            if (t > duration + post_duration) {
                env.draw_funworld = true;
            } else if (t > duration) {
                var u = t - duration;

                vec3.scaleAndAdd(shoe.trans, shoe.trans, shoe.rumble_fly_vec, u);

                shoe.rumble2[0] += 0.35;
                shoe.rumble2[1] += 0.12;
            } else {
                var u = Math.min(1, t/duration);
                u = Math.pow(u, 0.25);

                var freq = lerp(0, 7, u);
                var amp = u*u * QWQ.RAD_PER_DEG * 25;
                var tt = freq * t;

                var A = Math.pow(shoe.rumble_amount, 2.0);

                amp *= A;

                shoe.rumble2[0] = amp * fbm(tt, 0.1, 2);
                shoe.rumble2[1] = amp * fbm(tt, 0.3, 2);

                var amp2 = u * QWQ.RAD_PER_DEG * 2;
                amp2 *= A;

                shoe.rumble2[0] += amp2 * Math.cos(5 * t);
                shoe.rumble2[1] += amp2 * Math.sin(5 * t);

                shoe.trans[1] = 1.5 * amp2 * fbm(0.5*tt, 0.4, 2);
            }

        }
        
        if (!shoe.rumble) {
            var damp = 0.98;
            shoe.rumble2[0] *= damp;
            shoe.rumble2[1] *= damp;
            vec3.scale(shoe.trans, shoe.trans, 0.50);
        }

        mat4.identity(shoe.mat);
        mat4.translate(shoe.mat, shoe.mat, shoe.trans);

        var rx = shoe.rumble2[0] - shoe.rot[0] + shoe.rot_neutral[0];
        var ry = shoe.rumble2[1] - shoe.rot[1] + shoe.rot_neutral[1];
        var rz = shoe.rot_neutral[2];

        mat4.rotateX(shoe.mat, shoe.mat, rx);
        mat4.rotateY(shoe.mat, shoe.mat, ry);
        mat4.rotateZ(shoe.mat, shoe.mat, rz);
    }

    function update(env, dt) {
        update_params();
        update_part_selection(dt);
        update_shoe(env);
    }

    var ren = cloudflow_init_shoe_v3_ren();
    var ren_env = {
        camera: null,
        cw: 128,
        ch: 128,
        time: 0,
        mat: mat4.create(),
        rumble_amount: 0,
        selected_part_index: 0,
        part_select: shoe.part_select,
        enable_fxaa: true,
        color: 0
    };

    function draw(env) {
        ren_env.cw = env.el.width;
        ren_env.ch = env.el.height;
        ren_env.color = shoe.color;
        ren_env.camera = env.camera;
        ren_env.time = env.time;
        ren_env.rumble_amount = shoe.rumble_amount;
        ren_env.selected_part_index = shoe.selected_part_index;
        mat4.copy(ren_env.mat, shoe.mat);
        ren.draw(ren_env);
    }

    function pick(env) {
        ren_env.camera = env.camera;
        ren_env.time = env.time;
        mat4.copy(ren_env.mat, shoe.mat);
        return ren.pick(ren_env);
    }

    function set_picked_id(id) {
        var index = ren.get_index_from_picked_id(id);
        if (index !== shoe.selected_part_index) {
            shoe.selected_part_index = index;
        }
    }

    function start_rumble(env) {
        if (shoe.selected_part_index >= 0) {
            shoe.rumble = true;
            shoe.rumble_start_time = env.time;

            // random fly off direction
            vec3.set(shoe.rumble_fly_vec,
                lerp(-3, 3, Math.random()),
                lerp(-2.5, 2.5, Math.random()),
                10.0);
        }
    }

    var params = {
        rx: 30,
        ry: 0,
        rz: 0
    };

    function update_params() {
        vec3.set(shoe.rot_neutral, params.rx, params.ry, params.rz);
        vec3.scale(shoe.rot_neutral, shoe.rot_neutral, QWQ.RAD_PER_DEG);
    }
    
    0 && window.dat && (function() {
        var gui = new dat.GUI();
        dat.GUI.toggleHide();
        gui.add(params, 'rx', -180, 180);
        gui.add(params, 'ry', -180, 180);
        gui.add(params, 'rz', -180, 180);
    }());

    return shoe;

}
