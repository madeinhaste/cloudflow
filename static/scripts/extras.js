// some extra functions for gl-matrix
vec2.load = function(out, source, offset) {
    out[0] = source[offset + 0];
    out[1] = source[offset + 1];
};

vec2.save = function(vec, source, offset) {
    source[offset + 0] = vec[0];
    source[offset + 1] = vec[1];
};

vec3.load = function(out, source, offset) {
    out[0] = source[offset + 0];
    out[1] = source[offset + 1];
    out[2] = source[offset + 2];
};

vec3.save = function(vec, source, offset) {
    source[offset + 0] = vec[0];
    source[offset + 1] = vec[1];
    source[offset + 2] = vec[2];
};

vec4.load = function(out, source, offset) {
    out[0] = source[offset + 0];
    out[1] = source[offset + 1];
    out[2] = source[offset + 2];
    out[3] = source[offset + 3];
};

vec4.save = function(vec, source, offset) {
    source[offset + 0] = vec[0];
    source[offset + 1] = vec[1];
    source[offset + 2] = vec[2];
    source[offset + 3] = vec[3];
};

vec2.perp = function(out, vec) {
    var tmp = vec[0];
    out[0] = -vec[1];
    out[1] = tmp;
};

mat4.lerp = function(out, a, b, f) {
    for (var i = 0; i < 16; ++i) {
        out[i] = (1-f)*a[i] + f*b[i];
    }
    return out;
};

// binary xhr
function fetch_binary(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function(e) {
        // FIXME error check
        callback(xhr.response);
    };
    xhr.send();
}

function post_binary(url, data) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, false);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.send(data);
}

function post_json(url, data) {
    $.ajax({
        url: url,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data)
    });
}

// http://iquilezles.org/www/articles/palettes/palettes.htm
function make_palette(aa, bb, cc, dd) {
    function expand(v) {
        if (_.isNumber(v))
            return vec3.fromValues(v,v,v);
        else
            return vec3.clone(v);
    }

    var a = expand(aa);
    var b = expand(bb);
    var c = expand(cc);
    var d = expand(dd);

    return function(out, t) {
        for (var i = 0; i < 3; ++i) {
            out[i] = a[i] + b[i] * Math.cos(2*Math.PI * (c[i]*t + d[i]));
            //vec3.lerp(out, out, [1.0, 0.9, 0.2], 0.9);
        }
        return out;
    }
}


function init_blit() {
    var rt = new webgl.RenderTexture(128, 128, true);
    var quad = webgl.new_vertex_buffer(new Float32Array([ 0, 0, 0, 1, 1, 0, 1, 1 ]));
    var pgm = webgl.get_program('blit');

    var clear = _.once(function() {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    });

    return {
        resize: function(w, h) {
            if (rt.width !== w || rt.height !== h) {
                console.log('blit resize', w, h);
                rt.resize(w, h);
            }
        },

        draw_to: function(callback) {
            rt.render(callback);
        },

        draw: function(alpha) {
            clear();

            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);

            pgm.use();
            pgm.uniformSampler2D('s_rgba', rt.texture);
            pgm.uniform1f('alpha', alpha);
            webgl.bind_vertex_buffer(quad);
            pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.disable(gl.BLEND);
        }
    };
}


function Frustum() {
    this.planes = _.times(6, vec4.create);
}

Frustum.prototype.set_plane = function(index, a, b, c, d) {
    var f = this.planes[index];
    vec4.set(f, a, b, c, d);
    vec4.scale(f, f, 1 / vec3.length(f));
};

Frustum.prototype.update = function(m) {
    this.set_plane(0, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
    this.set_plane(1, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
    this.set_plane(2, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
    this.set_plane(3, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
    this.set_plane(4, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
    this.set_plane(5, m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
};

Frustum.prototype.test_sphere = function(s) {
    var planes = this.planes;
    for (var i = 0; i < 6; ++i) {
        var f = planes[i];
        var dist = vec3.dot(s, f) + f[3];
        if (dist < -s[3])
            return false;
    }
    return true;
};

function init_debug_sphere() {

    var programs = {
        simple: webgl.get_program('simple')
    };

    var mesh = null;
    var mesh_url = 'meshes/icosphere.msgpack';
    fetch_binary(mesh_url, function(data) {
        mesh = msgpack.decode(new Uint8Array(data));
        mesh.buffers = {
            verts: webgl.new_vertex_buffer(mesh.verts),
            elems: webgl.new_element_buffer(mesh.elems)
        };
    });

    var mvp = mat4.create();
    var color = vec4.fromValues(1, 0, 0, 1);

    function draw(env, mat, radius)
    {
        if (!mesh) return;

        mat4.identity(mvp);
        mvp[0] = mvp[5] = mvp[10] = radius;
        mat4.mul(mvp, mat, mvp);
        mat4.mul(mvp, env.camera.mvp, mvp);

        gl.disable(gl.BLEND);
        //gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        var pgm = programs.simple.use();
        pgm.uniformMatrix4fv('mvp', mvp);
        pgm.uniform4fv('color', this.color);

        webgl.bind_vertex_buffer(mesh.buffers.verts);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);

        webgl.bind_element_buffer(mesh.buffers.elems);
        gl.drawElements(gl.LINES, mesh.n_elems, gl.UNSIGNED_INT, 0);
    }

    return {
        color: color,
        draw: draw
    };

}

function pad_number(n, count, ch) {
    ch = ch || '0';
    var s = '' + n;
    count -= s.length;
    while (count-- > 0)
        s = ch + s;
    return s;
}

var PickRay = (function() {

    var tmpVec4 = vec4.create();

    function PickRay(camera) {
        this.camera = camera;
        this.origin = vec3.create();
        this.direction = vec3.create();
    }

    PickRay.prototype.unproject = function(out, vec) {
        var viewport = this.camera.viewport;
        var v = tmpVec4;

        v[0] = (vec[0] - viewport[0]) * 2.0 / viewport[2] - 1.0;
        v[1] = (vec[1] - viewport[1]) * 2.0 / viewport[3] - 1.0;
        v[2] = 2.0 * vec[2] - 1.0;
        v[3] = 1.0;

        vec4.transformMat4(v, v, this.camera.inv_mvp);
        if (v[3] === 0)
            return false;

        out[0] = v[0] / v[3];
        out[1] = v[1] / v[3];
        out[2] = v[2] / v[3];
        return true;
    };

    PickRay.prototype.fromWindowCoords = function(wx, wy) {
        var v0 = this.origin;
        var v1 = this.direction;
        v0[0] = v1[0] = wx;
        v0[1] = v1[1] = wy;
        v0[2] = 0.0;
        v1[2] = 1.0;
        this.unproject(v0, v0);
        this.unproject(v1, v1);
        vec3.subtract(v1, v1, v0);
        vec3.normalize(v1, v1);
    };

    return PickRay;

})();

function expovariate(mu) {
    return -mu * Math.log(1.0 - Math.random());
}
