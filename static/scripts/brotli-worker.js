importScripts('./vendor/brotli-dec.js');

onmessage = function(e) {
    var token = e.data.token;
    if (!token) {
        // test message
        return;
    }

    var src = e.data.data;
    var out = brotli_decompress(src);
    var msg = { token: token, data: out };

    postMessage(msg, [out]);
};
