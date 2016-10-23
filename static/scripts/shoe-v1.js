function cloudflow_init_shoe() {

    var lerp = QWQ.lerp;
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

        rot: vec2.create(),
        trans: vec3.create(),
        rumble2: vec2.create(),
        part_select: new Float32Array(4),
        
        red: false,
        
        toggle_fxaa: function() {
            return (ren_env.enable_fxaa = !ren_env.enable_fxaa);
        }
    };

    function update_part_selection(dt) {
        var delta = dt * 0.0015;
        for (var i = 0; i < 4; ++i) {
            if (i == shoe.selected_part_index)
                shoe.part_select[i] = Math.min(1, shoe.part_select[i] + delta);
            else
                shoe.part_select[i] = Math.max(0, shoe.part_select[i] - 3*delta);
        }
    }

    function update_shoe(env) {
        var Q = 1.5;
        //var rx = ((env.mouse.pos[1] / ch) - 0.5) * Q;
        //var ry = ((env.mouse.pos[0] / cw) - 0.5) * Q;
        var rx = Q * env.mouse.pos_nd[1];
        var ry = Q * env.mouse.pos_nd[0];
        var k = 0.1;
        shoe.rot[0] = lerp(shoe.rot[0], rx, k);
        shoe.rot[1] = lerp(shoe.rot[1], ry, k);

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
        mat4.rotateX(shoe.mat, shoe.mat, shoe.rumble2[0] - shoe.rot[0]);
        mat4.rotateY(shoe.mat, shoe.mat, shoe.rumble2[1] - shoe.rot[1]);
    }

    function update(env, dt) {
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
        red: false
    };

    function draw(env) {
        ren_env.cw = env.el.width;
        ren_env.ch = env.el.height;
        ren_env.red = shoe.red;
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

    function show_selected_part_name() {
        var index = shoe.selected_part_index;
        $('#debug').text(
            (index < 0) ? '' : [
                'MESH',
                'SOLE',
                'ENFORCEMENT',
                'MIDSOLE'
            ][index]);
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

    return shoe;

}
