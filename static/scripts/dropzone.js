function dropzone(el, callback) {

    el.ondragenter = function(e) {
        e.stopPropagation();
        e.preventDefault();
    };

    el.ondragover = function(e) {
        e.stopPropagation();
        e.preventDefault();
    };

    el.ondrop = function(e) {
        e.stopPropagation();
        e.preventDefault();
        on_drop(e);
    };

    var source_image = new Image;

    function on_drop(event) {
        var dt = event.dataTransfer;
        var files = dt.files;
        var count = files.length;

        if (files.length != 1)
            return;

        var file = files[0];
        console.log(file.type); // XXX check image

        var reader = new FileReader();
        reader.onload = function(e) {
            source_image.src = e.target.result;
            source_image.onload = function() {
                callback(source_image);
            };
        };
        reader.readAsDataURL(file);
    }

}
