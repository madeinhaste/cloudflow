$(function() {

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
    var language = $(window.frameElement).attr('lang') || 'en';

    var pages = [ page1, page2, page3, page4, page5 ];
    var page_index = -1;

    load_language(language)
        .then(start)
        .catch(function(err) {
            console.warn('cloudflow: couldn\'t load language', language);
            language = 'en';
            load_language(language).then(start);
        });

    function start() {
        show_page(0);
        $('.cf-container')
            .addClass('cf-container-visible');
    }

    function load_language(code) {
        return $.getJSON('data/copy/copy-' + code + '.json')
            .then(function(data) {
                copy_table = data;
            });
    }

    show_page(page_index);

    var cf_api = (function() {
        cf_api = cloudflow_main($('.cf-webgl')[0]);
        cf_api.set_visible(false);

        cf_api.on_experience = function(b) {
            if (b) {
                hide_all();
            } else {
                show_page(4);
            }
        };

        cf_api.on_hover = function(part) {
            if (page_index == 2 && part >= 0)
                show_page(3);
            else if (page_index == 3 && part < 0)
                show_page(2);
        };

        cf_api.on_rumble = function(v) {
            // TODO
        };

        return cf_api;
    }());

    $('.cf-experienced-close-bar a').on('click', function(e) {
        e.preventDefault();
        close_experienced();
    });

    function hide_all() {
        var names = [
            'instructions',
            'part-description',
            'experienced-overlay',
            'sticker',
            'loading',
            'links'
        ];

        names.forEach(function(name) {
            $('.cf-' + name).hide();
        });

        $('.cf-webgl').removeClass('cf-webgl-blurred');
    }

    function get_copy(id) {
        // lang selection etc..
        return _.get(copy_table, id);
    }

    function configure_sticker(size, heading, subheading) {
        $('.cf-sticker')
            .show()
            .removeClass('cf-sticker-transform-large cf-sticker-transform-small')
            .addClass('cf-sticker-transform-' + size);

        $('.cf-sticker-heading')
            .text(get_copy('sticker.heading.' + heading));

        $('.cf-sticker-subheading')
            .text(get_copy('sticker.subheading.' + subheading));
    }

    function configure_loading(percent) {
        $('.cf-loading')
            .show()
            .html(percent + get_copy('loading.percent_loading'));
    }

    function configure_links() {
        $('.cf-links').show();
        $('.cf-links')
            .find('a')
            .each(function(index, el) {
                $(el).text(get_copy('links.' + el.dataset.text));
            });
    }

    function configure_instructions(text) {
        $('.cf-instructions').show();
        $('.cf-instructions-text')
            .text(get_copy('instructions.' + text));
    }

    function configure_part_description(text) {
        $('.cf-part-description')
            .show()
            .text(get_copy('part_description.' + text));
    }

    function configure_experienced(text) {
        $('.cf-experienced-overlay').show();
        $('.cf-experienced')
            .text(get_copy('experienced.' + text));
    }

    function page1() {
        configure_sticker('large', 'shortcut', 'swiss_engineering');
        configure_loading(16);
        cf_api.set_visible(false);
    }

    function page2() {
        configure_sticker('large', 'introducing', 'swiss_engineering');
        configure_loading(68);
        cf_api.set_visible(false);
    }

    function page3() {
        configure_sticker('small', 'shortcut', 'introducing');
        configure_links();
        configure_instructions('hover');
        cf_api.set_visible(true);
    }

    function page4() {
        configure_sticker('small', 'shortcut', 'introducing');
        configure_links();
        configure_instructions('press');
        configure_part_description('mesh');
    }

    function page5() {
        configure_experienced('speedboard');
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
    }

    function show_next_page() {
        show_page(page_index + 1);
    }

    function show_prev_page() {
        show_page(page_index - 1);
    }

    $('.cf-webgl').on('click', function() {
        if (page_index < 2)
            show_next_page();
    });

    $('.cf-links a').on('click', function(e) {
        e.preventDefault();
    });

    //key('left', show_prev_page);
    //key('right', show_next_page);

});
