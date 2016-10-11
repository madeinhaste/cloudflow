// tunnel //
attribute vec2 coord;
varying vec2 v_coord;
uniform mat4 mvp;
uniform vec4 color;
uniform sampler2D t_frames;
uniform float time;

// tunnel.vertex //
vec3 transform_quat(vec3 v, vec4 q) {
    vec3 t = 2.0 * cross(q.xyz, v);
    return v + q.w*t + cross(q.xyz, t);
}

void main() {
    const float PI = 3.14159265359;
    const float TWO_PI = 2.0 * PI;

    vec3 P;
    float theta = TWO_PI * coord.x;
    float radius = 1.0;
    P.y = radius * cos(theta);
    P.z = radius * sin(theta);
    //P.z = 5.0 * mix(-2.0, 2.0, coord.y);
    P.x = 0.0;

    {
        vec3 T = texture2D(t_frames, vec2(coord.y, 0.0)).xyz;
        vec4 Q = texture2D(t_frames, vec2(coord.y, 1.0));
        P = transform_quat(P, Q);
        P += T;
    }

    gl_Position = mvp * vec4(P, 1.0);
    v_coord = vec2(coord.x, fract(coord.y + time));
}

// tunnel.fragment //
void main() {
    vec3 C0 = vec3(1, 1, 0);
    vec3 C1 = vec3(1, 0, 1);

    float z = 2.0 * abs(v_coord.y - 0.5);
    vec3 C = mix(C0, C1, z);

    {
        vec2 c = fract(16.0 * v_coord);
        float s = length(0.5 - c);
        if (s < 0.05)
            C = vec3(0, 0, 1);
    }

    gl_FragColor = vec4(C, 1.0);
}
