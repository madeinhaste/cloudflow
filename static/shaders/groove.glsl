// groove //
attribute vec2 coord;

varying vec3 v_normal;
varying vec3 v_view;

uniform mat4 mvp;
uniform vec4 color;
uniform sampler2D t_scape;
uniform float time;
uniform vec3 view_pos;

// groove.vertex //
vec3 get_pos(vec2 co) {
    vec3 P = 2.0 * (vec3(co.x, 0.5, co.y) - 0.5);
    P.z *= 1.0;
    P = P * 10.0;

    float center = 0.5 + 0.1 * sin(20.0 * time + 9.0 * co.y);
    float width = 0.1 + 0.05 * sin(1.0 * time + 9.0 * co.y);
    float h = -smoothstep(0.05 + width, 0.01 + width, abs(co.x - center));

    //float h = texture2D(t_scape, vec2(co.x, co.y + time)).r;
    P.y = h;

    P.y -= 2.0 * (1.0 + sin(3.0*time + 3.0 * co.y));
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

// groove.fragment //
void main() {
    // worldspace normal
    vec3 N = normalize(v_normal);
    vec3 V = -normalize(v_view);
    float NdotV = max(0.0, dot(N, V));
    NdotV = mix(NdotV, 1.0, 0.5);
    //gl_FragColor = vec4((N + 1.0)/2.0, 1.0);
    gl_FragColor = vec4(NdotV * color.rgb, 1.0);
}
