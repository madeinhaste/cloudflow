(function() {

    console.assert(window.Worker);

    var worker = new Worker('scripts/brotli-worker.js');

    var next_token = 1000;
    var token_resolves = {};

    worker.onmessage = function(e) {
        var token = e.data.token;
        //console.log('recv token:', token);
        var output = e.data.data;
        var resolve = token_resolves[token];
        console.assert(resolve);
        delete token_resolves[token];
        resolve(output);
    };

    var has_transferable_objects = (function() {
        var buffer = new ArrayBuffer(1);
        worker.postMessage({ data: buffer }, [ buffer ]);
        return buffer.byteLength == 0;
    }());

    //console.log('has_transferable_objects:', has_transferable_objects);
    //$('#debug').text('transferable_objects: ' + has_transferable_objects);

    function brotli_decompress2(src) {
        return new Promise(function(resolve) {
            var token = next_token++;
            token_resolves[token] = resolve;
            //console.log('send token:', token);

            var msg = { token: token, data: src };
            worker.postMessage(msg, has_transferable_objects ? [src] : undefined);
        });
    }

    window.brotli_decompress2 = brotli_decompress2;

}());
