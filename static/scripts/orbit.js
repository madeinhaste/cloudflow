var Orbit = (function() {

    function Orbit(ry, rx, distance) {
        ry = ry || 0.0;
        rx = rx || 0.0;
        distance = distance || 10.0;
        this.rotate = vec3.fromValues(ry, rx, 0.0);
        this.translate = vec3.fromValues(0, 0, 0);
        this.distance = distance;

        this.pos = vec3.create();
        this.dir = vec3.create();
        this.up = vec3.fromValues(0, 1, 0);
    }

    var Q = quat.create();
    var T = vec3.create();

    Orbit.prototype.copy = function(other) {
        vec3.copy(this.rotate, other.rotate);
        vec3.copy(this.translate, other.translate);
        this.distance = other.distance;
        this.update();
    };

    Orbit.prototype.set_focal_point = function(pos) {
        vec3.copy(this.translate, pos);
    };

    Orbit.prototype.pan = function(dx, dy) {
        quat.identity(Q);
        quat.rotateY(Q, Q, this.rotate[0]);
        quat.rotateX(Q, Q, this.rotate[1]);

        vec3.set(T, dx, dy, 0);
        vec3.transformQuat(T, T, Q);
        vec3.add(this.translate, this.translate, T);
    };

    Orbit.prototype.tumble = function(ry, rx) {
        this.rotate[0] += ry;
        this.rotate[1] += rx;
    };

    var min_distance = 0.001;

    Orbit.prototype.dolly = function(dz) {
        this.distance = Math.max(min_distance, this.distance + dz);
    };

    Orbit.prototype.zoom = function(sz) {
        this.distance = Math.max(min_distance, this.distance * sz);
    };

    Orbit.prototype.update = function() {
        quat.identity(Q);
        quat.rotateY(Q, Q, this.rotate[0]);
        quat.rotateX(Q, Q, this.rotate[1]);

        //vec3.transformQuat(this.pos, this.translate, Q);
        vec3.set(this.dir, 0, 0, -1);
        vec3.transformQuat(this.dir, this.dir, Q);
        vec3.scaleAndAdd(this.pos, this.translate, this.dir, -this.distance);
    };

    Orbit.prototype.dump = function() {
        var r = this.rotate;
        var t = this.translate;
        var d = this.distance;

        var code = [ r[0], r[1], t[0], t[1], t[2], d ];
        return QWQ.base64_encode(new Float32Array(code));
    };

    Orbit.prototype.dump2 = function() {
        return {
            rotate: this.rotate,
            translate: this.translate,
            distance: this.distance
        };
    };

    Orbit.prototype.load2 = function(o) {
        vec3.copy(this.rotate, o.rotate);
        vec3.copy(this.translate, o.translate);
        this.distance = o.distance;
        this.update();
    };

    Orbit.prototype.load = function(value) {
        var c = QWQ.base64_decode(value, Float32Array);
        vec2.set(this.rotate, c[0], c[1]);
        vec3.set(this.translate, c[2], c[3], c[4]);
        this.distance = c[5];
        this.update();
    };

    return Orbit;

}());
