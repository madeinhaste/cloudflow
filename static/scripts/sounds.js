var sounds = (function() {

    var sounds = (function() {
        return {
            s0_ambient: new Howl({
                src: ['sounds/0/ambient.ogg'],
                loop: true
            }),
            s0_rollover_1: new Howl({
                src: ['sounds/0/rollover-1.ogg'],
                volume: 0.2
            }),
            s0_rollover_2: new Howl({
                src: ['sounds/0/rollover-2.ogg'],
                volume: 0.2
            }),
            s0_rollover_3: new Howl({
                src: ['sounds/0/rollover-3.ogg'],
                volume: 0.2
            }),
            s0_rollover_4: new Howl({
                src: ['sounds/0/rollover-4.ogg'],
                volume: 0.2
            }),
            s0_enter: new Howl({
                src: ['sounds/0/enter.ogg'],
            }),
            s0_exit: new Howl({
                src: ['sounds/0/exit.ogg'],
            }),
            s0_charge: new Howl({
                src: ['sounds/0/charge.ogg'],
                rate: 2.0
            }),

            // mesh/tunnel
            s1_ambient: new Howl({
                src: ['sounds/1/ambient.ogg'],
            }),

            // clouds
            s2_ambient: new Howl({
                src: ['sounds/2/ambient.ogg'],
            }),

            // enforcements/reflections
            s3_ambient: new Howl({
                src: ['sounds/3/ambient.ogg'],
            }),

            // midsole/speedboard
            s4_ambient: new Howl({
                src: ['sounds/4/ambient2.ogg'],
            }),
        };
    }());

    var set_ambient_sound_index = (function() {
        var ambient_sounds = [
            sounds.s0_ambient,
            sounds.s1_ambient,
            sounds.s2_ambient,
            sounds.s3_ambient,
            sounds.s4_ambient,
        ];
        var ambient = null;
        var ambient_volume = 1.0;
        return function(idx) {
            var s = ambient_sounds[idx];
            if (s !== ambient) {
                ambient && ambient.stop();

                if (!ambient) {
                    // start-up fade in
                    s.volume(0);
                    s.play();
                    s.fade(0.0, ambient_volume, 10000);
                } else {
                    s.volume(ambient_volume);
                }

                s.play();
                ambient = s;
            }
        }
    }());

    var play_rollover_sound = (function() {
        // idx == hover_part (0..3)
        var rollover_wait = 500;
        var rollover_sounds = _.times(4, function(idx) {
            var sound = sounds['s0_rollover_' + (idx + 1)];
            return _.throttle(function() { sound.play() }, rollover_wait);
        });

        return function(idx) {
        return;
            rollover_sounds[idx]();
        }
    }());

    var charge = 0;

    return {
        ambient: set_ambient_sound_index,
        rollover: play_rollover_sound,
        enter_experience: function() {
            sounds.s0_enter.play();
        },
        leave_experience: function() {
            sounds.s0_exit.play();
        },
        charge: function(amount) {
            amount = QWQ.clamp(amount, 0, 1);
            var sound = sounds.s0_charge;

            if (amount == 0) {
                if (charge != 0) {
                    charge = 0;
                    //sound.fade(1.0, 0.0, 200);
                    sound.stop();
                }
                return;
            } else {
                sound.volume(amount);
                if (charge == 0) {
                    sound.play();
                }
                charge = amount;
            }
        }
    };

}());
