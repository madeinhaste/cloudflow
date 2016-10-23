importScripts('./vendor/brotli-dec.js');

onmessage = function(e) {
    var src = e.data.data;
    var token = e.data.token;
    var out = brotli_decompress(src);
    postMessage({
        token: token,
        data: out
    });
};
