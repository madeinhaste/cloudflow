// groove //
attribute vec2 coord;
varying vec3 v_normal;
varying vec3 v_position;

// groove.vertex //
uniform mat4 mvp;
uniform float time;
uniform sampler2D t_curve;

vec3 get_pos(vec2 co) {
    vec3 P;
    P.x = 20.0 * (co.x - 0.5);
    P.y = 0.5;
    P.z = 0.0;

    float center = 0.5;
    float w = 0.1;
    float width = mix(0.0, 0.1,
        smoothstep(w + 0.1, w, abs(fract(time + co.y) - 0.5)));
    float h = -smoothstep(0.08 + width, 0.02 + width, abs(co.x - center));
    P.y = h;

    //if (coord.x == 0.0) P.x -= 1000.0;
    //if (coord.x == 1.0) P.x += 1000.0;

    {
        vec3 T = texture2D(t_curve, vec2(co.y, 0.0)).xyz;
        //vec4 Q = texture2D(t_curve, vec2(co.y, 1.0));
        //P = transform_quat(P, Q);
        //P += T;
        //P.xy += T.xy;
        //P.z += 100.0*T.z;
        P += T;
    }

    return P;
}

void main() {
    vec3 P = get_pos(coord);
    vec3 Pdx = normalize(get_pos(coord + vec2(1.0/256.0, 0.0)) - P);
    vec3 Pdy = normalize(get_pos(coord + vec2(0.0, 1.0/256.0)) - P);
    vec3 N = cross(Pdx, Pdy);

    gl_Position = mvp * vec4(P, 1.0);
    v_normal = N;
    v_position = P;
}

// groove.fragment //
uniform vec4 color;
uniform vec3 view_pos;

vec3 toLinear(vec3 rgb) {
    return pow(rgb, vec3(2.2));
}

vec3 filmic(vec3 c) {
    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

void main() {
    vec3 N = normalize(v_normal);
    vec3 V = normalize(view_pos - v_position);
    vec3 light_pos = vec3(4, 10, 3);
    vec3 L = normalize(light_pos - v_position);

    float NdotL = max(0.0, dot(N, L));
    //gl_FragColor = vec4((N + 1.0)/2.0, 1.0);

    float diffuse = 0.00 + NdotL;
    vec3 C = diffuse * toLinear(color.rgb);
    gl_FragColor = vec4(filmic(C), 1.0);
    //gl_FragColor = vec4(0.5*(N + 1.0), 1.0);
    //gl_FragColor = vec4(1, 0,0, 1);
}




// spd_background //
attribute vec2 coord;
varying vec3 v_color;

// spd_background.vertex //
uniform vec3 color0;
uniform vec3 color1;

void main() {
    gl_Position = vec4(2.0*(coord - 0.5), 0.0, 1.0);
    v_color = mix(color0, color1, coord.y);
}

// spd_background.fragment //
void main() {
    gl_FragColor = vec4(v_color, 1.0);
}
