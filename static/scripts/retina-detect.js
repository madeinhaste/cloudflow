function retina_detect(gl) {
    var dpr = window.devicePixelRatio;
    if (dpr <= 1.0)
        return false;

    function get_bspr() {
        var c = document.createElement('canvas');
        var ctx = c.getContext('2d');
        var bspr = (
            ctx.webkitBackingStorePixelRatio ||
            ctx.mozBackingStorePixelRatio ||
            ctx.msBackingStorePixelRatio ||
            ctx.oBackingStorePixelRatio ||
            ctx.backingStorePixelRatio || 1);
        return bspr;
    }

    if (get_bspr() !== 1.0) {
        // don't know what do to here
        return false;
    }

    var version = gl.getParameter(gl.VERSION);
    if (version.match(/Apple A10 GPU/)) {
        // iPhone 7
        return true;
    }

    if (version.match(/Apple A9X GPU/)) {
        // iPad Pro
        return true;
    }

    if (version.match(/Apple A9 GPU/)) {
        // iPhone 6s (untested)
        return true;
    }

    if (version.match(/(OpenGL ES 2.0 Chromium)/) &&
        gl.getSupportedExtensions().indexOf('WEBGL_compressed_texture_s3tc') >= 0)
    {
        // Desktop Chrome
        return true;
    }

    return false;
}
