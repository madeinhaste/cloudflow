// arc //
attribute vec2 coord;
uniform mat4 mvp;
uniform vec4 color;
uniform float time;
uniform vec4 pos;

// arc.vertex //
void main() {
    float z = pos.z + 2.0 * time;

    float x = fract(2.0*coord.x + z);
    float y = 1.0 - pow(2.0*(x - 0.5), 2.0);
    y *= pos.w;
    y += pos.y;
    vec3 P = vec3(pos.x, y, 10.0 * coord.x);
    P.z += z;
    gl_Position = mvp * vec4(P, 1.0);
}

// arc.fragment //
void main() {
    gl_FragColor = color;
}
