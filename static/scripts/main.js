var USE_TEXLOD_FIX = false;

function cloudflow_main(canvas) {

    var lerp = QWQ.lerp;

    var canvas = new Canvas3D_v2({
        el: canvas,
        shaders: [
            'default',
            'shoe2',
            'shoe_pick2',
            'fxaa',
            'meshflow',
            'cloud',
            'earth',
            'particles',
            'reflections',
            'arc',
            'groove',
            'widget',
            'cube',
            'background'
        ]
    });

    var debug = document.querySelector('.debug');
    var fps = new QWQ.FPS(debug);

    key('r', function() {
        if (canvas.dpr == 1) return;
        canvas.retina = !canvas.retina;
        fps.dpr = (canvas.retina ? canvas.dpr : 1);
    });

    key('c', function() {
        ++shoe.color;
    });

    key('f', function() {
        fps.fxaa = shoe.toggle_fxaa();
    });

    key('m', function() {
        sounds.mute();
    });

    //sounds.mute();

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

    var meshflow = init_meshflow();
    var clouds = init_clouds();
    var reflections = init_reflections();
    var speedboard = init_speedboard();

    var experience_visible = 0;
    function set_experience_visible(idx) {
        if (idx == experience_visible)
            return;

        // 0: not visible => shoe
        // 1: mesh/clouds
        // 2: 

        if (idx) {
            sounds.enter_experience();

            // for sounds
            if (idx == 1) meshflow.enter(!shoe.color);
        } else {
            sounds.leave_experience();
            // flip shoe color
            shoe.color = shoe.color ? 0 : 1;

            // for sounds
            if (experience_visible == 1) meshflow.leave();
        }

        sounds.ambient(idx);
        experience_visible = idx;
        api.on_experience(idx !== 0);
    }

    var hover_part = -1;

    var api_update_on_hover = _.throttle(function() {
        api.on_hover(hover_part);
    }, 250);
    
    function set_hover_part() {
        var part = shoe.selected_part_index;
        if (part == hover_part)
            return;

        hover_part = shoe.selected_part_index;
        //api.on_hover(hover_part);
        api_update_on_hover();

        if (hover_part >= 0)
            sounds.rollover(hover_part);
    }

    var charging = false;
    function set_charging(b) {
        if (b == charging)
            return;

        charging = b;
        sounds.charge(b ? 1 : 0);
        api.on_charge(b ? 1 : 0);
    }

    //var $debug = $('.debug');

    canvas.draw = function() {
        if (!visible)
            return;

        if (1) {
            //var b = [this.draw_funworld, shoe.rumble, hover_part];
            //$debug.text(b);
            
            if (this.draw_funworld && shoe.rumble && hover_part >= 0) {
                set_experience_visible(hover_part + 1);

                if (hover_part == 0) {
                    meshflow.update(this);
                    meshflow.draw(this, true);
                } else if (hover_part == 1) {
                    clouds.update(this);
                    clouds.draw(this);
                } else if (hover_part == 2) {
                    //gl.clearColor(0, 0.1, 0.3, 1.0);
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    reflections.update(this);
                    reflections.draw(this, true);
                } else if (hover_part == 3) {
                    gl.clearColor(0.7, 0.9, 1.0, 1.0);
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    speedboard.update(this);
                    speedboard.draw(this);
                }

                // make sure alpha channel is opaque
                // TODO take another look once we have a real background 
                gl.colorMask(false, false, false, true);
                gl.clearColor(0, 0, 0, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.colorMask(true, true, true, true);
            } else {
                this.camera.fov = 25;
                this.camera.near = 0.1;
                this.camera.far = 800;

                set_experience_visible(0);
                shoe.draw(this);

                set_charging(!!shoe.rumble);
            }
        }
    };

    canvas.pick = function() {
        if (visible && !this.draw_funworld) {
            if (!shoe.rumble) {
                shoe.pick(this);
                //set_hover_part();
            }
        }
    };

    function on_hold() {
        if (hover_part >= 0)
            shoe.start_rumble(canvas);
    }

    function on_release() {
        shoe.stop_rumble(canvas);
    }

    document.addEventListener('mousedown', on_hold, false);
    document.addEventListener('mouseup', on_release, false);

    canvas.el.addEventListener('touchstart', on_hold, false);
    canvas.el.addEventListener('touchend', on_release, false);

    var last_time = 0;
    canvas.dt = 0;
    function animate(t) {
        canvas.time = t;
        var dt;
        if (!last_time) {
            last_time = t;
            dt = 0;
        } else {
            var dt = t - last_time;
            last_time = t;
            canvas.dt = dt;
        }

        if (shoe.ready())
            canvas.orbit.distance = lerp(canvas.orbit.distance, target_orbit_distance, 0.003*dt);

        requestAnimationFrame(animate);

        if (1) {
            shoe.update(canvas, dt);

            if (!shoe.rumble) {
                // only pick when not rumbling (or in experience)
                var result = canvas._pick();
                if (result !== undefined) {
                    //console.log('pick:', result);
                    shoe.set_picked_id(result);
                    set_hover_part();
                }
            }
        }

        canvas._draw();
        //fps.update();
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
        on_charge: function(v) {},
        on_loading: function(fraction) {}
    };

    // loader hookup
    var n_resources = 25;
    cloudflow_loader.on_progress = function(done) {
        api.on_loading(done / n_resources);
    };
    cloudflow_loader.on_complete = function() {
        api.on_loading(1.0);
    };

    return api;
}
