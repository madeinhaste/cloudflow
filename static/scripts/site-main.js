$(function() {

    // http://stackoverflow.com/questions/7731778/get-query-string-parameters-with-jquery
    function get_url_param(key) {
        key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, "\\$&"); // escape RegEx meta chars
        var match = location.search.match(new RegExp("[?&]"+key+"=([^&]+)(&|$)"));
        return match && decodeURIComponent(match[1].replace(/\+/g, " "));
    }

    // determine language and setup loading sticker first
    var language = (
        get_url_param('lang') ||
        $(window.frameElement).attr('lang') ||
        'en');
    configure_sticker('large', 'introducing');

    // init webgl

    var cf_api = (function() {
        var api = cloudflow_main($('.cf-webgl')[0]);
        api.set_visible(false);

        api.on_experience = function(b) {
            if (b) {
                hide_all();
            } else {
                show_page(4);
            }
        };

        api.on_hover = function(part) {
            if (part >= 0)
                hover_part = hover_parts[part];

            if (page_index == 2 && part >= 0) {
                show_page(3);
            }
            else if (page_index == 3) {
                if (part < 0)
                    show_page(2);
                else
                    show_page(3);
            }
        };

        //var charger = $('.cf-part-charge')[0];
        api.on_charge = function(charging) {
            $('.cf-charger-blue').toggleClass('cf-charger-charged', charging);
            $('.cf-instruction').toggleClass('cf-instruction-charged', charging);
        };

        api.on_loading = function(frac) {
            if (page_index == 0 && frac > 0.5)
                show_page(1);

            configure_loading(Math.round(100 * frac));

            if (frac >= 1.0)
                show_page(2);
        };

        return api;
    }());


    // iframe events
    window.onmessage = function(e) {
        var o = (e.origin || e.originalEvent.origin);
        // FIXME check o

        var msg = JSON.parse(e.data);
        if (msg.set_language)
            set_language(msg.set_language);
    }; 

    function set_language(language) {
        load_language(language)
            .then(function() {
                show_page(page_index);
            });
    }

    hide_all();

    var copy_table = null;
    //console.info('cloudflow: url query:', location.search);
    //console.info('cloudflow: language:', language);

    var pages = [ page1, page2, page3, page4, page5 ];
    var page_index = -1;

    load_language(language)
        .then(start)
        .catch(function(err) {
            console.warn('cloudflow: couldn\'t load language', language);
            console.warn('cloudflow: loading default');
            language = 'en';
            load_language(language).then(start);
        });

    function start() {
        show_page(0);
        $('.cf-container')
            .addClass('cf-visible');
    }

    function load_language(code) {
        return fetch('data/copies/copies.' + code + '.json')
            .then(function(res) { return res.json() })
            .then(function(data) {
                copy_table = data;
            })
            .catch(function(err) {
                console.error('couldn\'t load lanuage file:', code, err);
                throw err;
            });
    }

    // part names for copies
    var hover_parts = [ 'mesh', 'outsole', 'enforcement', 'speedboard' ];
    var hover_part = hover_parts[3];

    //$('.cf-experienced-close-bar a').on('click', function(e) {
    $('.cf-experienced-overlay').on('click', function(e) {
        e.preventDefault();
        close_experienced();
    });

    function hide_all() {
        var names = [
            'lower-third',
            'experienced-overlay',
            'sticker',
            'links',
        ];

        names.forEach(function(name) {
            $('.cf-' + name).hide();
        });

        $('.cf-webgl').removeClass('cf-webgl-blurred');
    }

    function get_copy(id) {
        // lang selection etc..
        //return _.get(copy_table, id);
        return copy_table[id] || 'nocopy';
    }

    function configure_sticker(size, name) {
        $('.cf-sticker')
            .show()
            .removeClass('cf-sticker-transform-large cf-sticker-transform-small')
            .addClass('cf-sticker-transform-' + size);

        var sticker_languages = ['en', 'fr', 'de', 'ja', 'it'];
        var lang = _.includes(sticker_languages, language) ? language : 'en';

        $('.cf-sticker-img')
            .attr('src', 'images/stickers/' + name + '-' + lang + '.svg');
    }

    function configure_loading(percent) {
        $('.cf-lower-third').show();
        $('.cf-instruction').text(percent + '% loading');
        $('.cf-charger').css({ width: percent + '%' });
    }

    function configure_links() {
        $('.cf-links')
            .show()
            .find('a')
            .each(function(index, el) {
                $(el)
                    .text(get_copy(el.dataset.copy))
            });
    }

    function configure_instruction(text) {
        $('.cf-lower-third').show();
        $('.cf-instruction').text(get_copy(text));
    }

    function configure_part_description(part) {
        if (part) {
            $('.cf-description')
                .text(get_copy(part+'.rollover'));
        } else {
            $('.cf-description')
                .text('');
        }
    }

    function configure_experienced(part) {
        $('.cf-experienced-overlay').show();
        $('.cf-experienced-headline')
            .text(get_copy(part+'.headline'));
        $('.cf-experienced')
            .text(get_copy(part+'.copy'));
    }

    function page1() {
        configure_sticker('large', 'introducing');
        cf_api.set_visible(false);
    }

    function page2() {
        configure_sticker('large', 'shortcut');
        cf_api.set_visible(false);
    }

    function page3() {
        configure_sticker('small', 'shortcut', 'introducing');
        configure_links();
        configure_instruction('ui.click_and_hold');
        configure_part_description(null);
        cf_api.set_visible(true);
    }

    function page4() {
        configure_sticker('small', 'shortcut', 'introducing');
        configure_links();
        configure_instruction('ui.click_and_hold');
        configure_part_description(hover_part);
        $('.cf-instructions-charge').show();
    }

    function page5() {
        configure_experienced(hover_part);
        $('.cf-webgl').addClass('cf-webgl-blurred');
    }

    function close_experienced() {
        show_page(3);
    }

    function show_page(index) {
        //if (index == page_index) return;

        if (index < 0 || index >= pages.length)
            return;

        if (index == 2 && page_index == 1)
            cf_api.reset();

        hide_all();
        page_index = index;
        pages[index]();

        /*
        $('.home-template').css({
            backgroundImage: 'url(../images/home-' + (page_index+1) + '.jpg)'
        });
        */
    }

    function show_next_page() {
        show_page(page_index + 1);
    }

    function show_prev_page() {
        show_page(page_index - 1);
    }

    show_page(page_index);

    /*
    $('.cf-webgl').on('click', function() {
        if (page_index < 2)
            show_next_page();
    });
    */

   /*
    $('.cf-links a').on('click', function(e) {
        e.preventDefault();
    });
    */

    //Howler.mute(true);
    //key('left', show_prev_page);
    //key('right', show_next_page);

});
