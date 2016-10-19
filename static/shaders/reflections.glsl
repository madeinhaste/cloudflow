// landscape //
attribute vec2 coord;

varying vec3 v_normal;
varying vec3 v_view;

uniform mat4 mvp;
uniform vec4 color;
uniform sampler2D t_scape;
uniform float time;
uniform vec3 view_pos;

// landscape.vertex //
vec3 get_pos(vec2 co) {
    vec3 P = 2.0 * (vec3(co.x, 0.5, co.y) - 0.5);
    P.z *= 2.0;
    P = P * 10.0;
    float h = texture2D(t_scape, vec2(co.x, co.y + time)).r;
    P.y = 1.0 * h;
    return P;
}

void main() {
    vec3 P = get_pos(coord);
    vec3 Pdx = normalize(get_pos(coord + vec2(1.0/256.0, 0.0)) - P);
    vec3 Pdy = normalize(get_pos(coord + vec2(0.0, 1.0/256.0)) - P);
    vec3 N = cross(Pdx, Pdy);

    gl_Position = mvp * vec4(P, 1.0);
    v_normal = N;
    v_view = normalize(view_pos - P);
}

// landscape.fragment //
void main() {
    // worldspace normal
    vec3 N = normalize(v_normal);
    vec3 V = -normalize(v_view);
    float NdotV = max(0.0, dot(N, V));
    //gl_FragColor = vec4((N + 1.0)/2.0, 1.0);
    gl_FragColor = vec4(NdotV * color.rgb, 1.0);
}
