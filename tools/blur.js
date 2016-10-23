function calc_iir_weights(sigma, B, M) {
    var K1 = 2.44413;                                                 
    var K2 = 1.4281;                                                  
    var K3 = 0.422205;                                                
    var q = (sigma >= 2.5) ?
        (0.98711 * sigma - 0.96330) :
        (3.97156 - 4.14554 * Math.sqrt(1 - 0.26891 * sigma));

    var b0 = 1.57825 + q*(K1 + q*(    K2 + q *     K3));              
    var b1 =           q*(K1 + q*(2 * K2 + q * 3 * K3));              
    var b2 =         - q*      q*(    K2 + q * 3 * K3);               
    var b3 =           q*      q*          q *     K3;                

    var a1 = b1 / b0;                                                 
    var a2 = b2 / b0;                                                 
    var a3 = b3 / b0;                                                 
    var c  = 1.0 / ((1+a1-a2+a3) * (1+a2+(a1-a3)*a3));                 

    M[0] = c * (-a3*(a1+a3)-a2 + 1);                                         
    M[1] = c * (a3+a1)*(a2+a3*a1);                                           
    M[2] = c * a3*(a1+a3*a2);                                                
    M[3] = c * (a1+a3*a2);                                                   
    M[4] = c * (1-a2)*(a2+a3*a1);                                            
    M[5] = c * a3*(1-a3*a1-a3*a3-a2);                                        
    M[6] = c * (a3*a1+a2+a1*a1-a2*a2);                                       
    M[7] = c * (a1*a2+a3*a2*a2-a1*a3*a3-a3*a3*a3-a3*a2+a3);                  
    M[8] = c * a3*(a1+a3*a2);                                                

    B[0] = 1 - (b1 + b2 + b3) / b0;
    B[1] = a1;
    B[2] = a2;
    B[3] = a3;
}                                                                             

function _blur_iir2(dst, src, B, M, w, h, stride, pitch, channel) {
    var len = w;
    var tmp = new Float64Array(len + 6);
    var u = new Float64Array(3);

    for (var y = 0; y < h; ++y) {
        var sp = y*stride + channel;

        for (var i = 0; i < 3; ++i)
            tmp[i] = src[sp];

        // forward
        for (var i = 3; i < len + 3; ++i) {
            var t = src[sp] * B[0];
            sp += pitch;
            for (var j = 1; j < 4; ++j)
                t += B[j] * tmp[i - j];
            tmp[i] = t;
        }

        // fix right boundary
        var uplus = src[sp - pitch];
        u[0] = tmp[3 + len - 1] - uplus;
        u[1] = tmp[3 + len - 2] - uplus;
        u[2] = tmp[3 + len - 3] - uplus;
        for (var i = 0; i < 3; ++i) {
            var t = 0.0;
            for (var k = 0; k < 3; ++k)
                t += M[3*i + k] * u[k];
            tmp[3 + len + i] = t + uplus;
        }

        // backward
        var dp = sp - pitch;
        for (var i = 3 + len - 1; 3 <= i; --i) {
            var t = 0.0;
            for (var j = 0; j < 4; ++j)
                t += B[j] * tmp[i + j];
            dst[dp] = tmp[i] = t;
            dp -= pitch;
        }
    }
}

function copy_image(dst, src, channel) {
    var dp = channel;
    var dp_end = dst.length;
    while (dp < dp_end) {
        dst[dp] = src[dp];
        dp += 4;
    }
    return dst;
}

function blur_iir(opts) {
    var dst = opts.dst;
    var src = opts.src || dst;
    var channel = opts.channel;
    var w = opts.width;
    var h = opts.height;
    var sigma = opts.sigma;
    
    var B = new Float64Array(4);
    var M = new Float64Array(9);
    var tmp = new Uint8ClampedArray(4 * w * h);

    calc_iir_weights(sigma, B, M);
    _blur_iir2(tmp, src, B, M, w, h, w*4, 4, channel);
    _blur_iir2(dst, tmp, B, M, h, w, 4, 4*w, channel);
}

module.exports = blur_iir;
