var sounds = (function() {

    function get_sound(path, loop) {
        var base_url = 'sounds/' + path;
        var exts = ['ogg', 'm4a', 'mp3'];
        var src = _.map(exts, function(ext) { return base_url + '.' + ext });
        
        return new Howl({
            src: src,
            loop: loop
        });
    }

    var rzo_sounds = {
        enter: get_sound('rzo/rzo-enter'),
        leave: get_sound('rzo/rzo-leave'),
        charge: get_sound('rzo/rzo-charge'),
    };

    var set_ambient_sound_index = (function() {
        var ambient_sounds = [
            get_sound('rzo/rzo-loop', true),
            get_sound('mfl/mfl-loop', true),
            get_sound('zgf/zgf-loop', true),
            get_sound('enf/enf-loop', true),
            get_sound('spd/spd-loop', true),
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
        var rollover_wait = 250;
        var rollover_sounds = [
            make_rollover_sound('rzo/rzo-hover-mfl'),
            make_rollover_sound('rzo/rzo-hover-zgf'),
            make_rollover_sound('rzo/rzo-hover-enf'),
            make_rollover_sound('rzo/rzo-hover-spd')
        ];

        function make_rollover_sound(path) {
            var sound = get_sound(path);
            return _.throttle(function() { sound.play() }, rollover_wait);
        }
            
        return function(idx) {
            rollover_sounds[idx]();
        }
    }());

    var charge = 0;

    return {
        ambient: set_ambient_sound_index,
        rollover: play_rollover_sound,
        enter_experience: function() {
            rzo_sounds.enter.play();
        },
        leave_experience: function() {
            rzo_sounds.leave.play();
        },
        charge: function(amount) {
            amount = QWQ.clamp(amount, 0, 1);
            var sound = rzo_sounds.charge;

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
        },
        get: get_sound
    };

}());
