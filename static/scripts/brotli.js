(function() {

    console.assert(window.Worker);

    var worker = new Worker('scripts/brotli-worker.js');

    var next_token = 1000;
    var token_resolves = {};

    worker.onmessage = function(e) {
        var token = e.data.token;
        console.log('recv token:', token);
        var output = e.data.data;
        var resolve = token_resolves[token];
        console.assert(resolve);
        delete token_resolves[token];
        resolve(output);
    };

    function brotli_decompress2(src) {
        return new Promise(function(resolve) {
            var token = next_token++;
            token_resolves[token] = resolve;
            console.log('send token:', token);
            worker.postMessage({
                token: token,
                data: src
            });
        });
    }

    window.brotli_decompress2 = brotli_decompress2;

}());
