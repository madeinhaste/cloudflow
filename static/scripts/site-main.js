$(function() {

    var copy_table = null;

    function load_language(code) {
        $.getJSON('data/copy/copy-' + code + '.json').then(function(data) {
            copy_table = data;
            show_page(page_index);
        });
    }

    load_language('en');

    $('.language-selector select').on('change', function() {
        load_language(this.value);
        $(this).blur();
    });

    // load html
    $.get('cloudflow.html')
        .then(function(html) {
            $('.cloudflow').html(html);

            $('.cf-experienced-close-bar a').on('click', function(e) {
                e.preventDefault();
                close_experienced();
            });

            show_page(0);
        });

    // load styles
    (function() {
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'styles/cloudflow.css';
        $('head').append(l);
    }());

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
        $('.cf-instructions')
            .show()
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
    }

    function page2() {
        configure_sticker('large', 'introducing', 'swiss_engineering');
        configure_loading(68);
    }

    function page3() {
        configure_sticker('small', 'shortcut', 'introducing');
        configure_links();
        configure_instructions('hover');
    }

    function page4() {
        configure_sticker('small', 'shortcut', 'introducing');
        configure_links();
        configure_instructions('press');
        configure_part_description('mesh');
    }

    function page5() {
        configure_experienced('speedboard');
    }

    function close_experienced() {
        show_page(3);
    }

    var pages = [ page1, page2, page3, page4, page5 ];
    var page_index = -1;

    function show_page(index) {
        //if (index == page_index) return;

        if (index < 0 || index >= pages.length)
            return;

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

    key('left', show_prev_page);
    key('right', show_next_page);


});
