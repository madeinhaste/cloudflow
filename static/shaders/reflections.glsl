// landscape //
attribute vec2 coord;

varying vec3 v_normal;
varying vec3 v_view;
varying vec3 v_position;

uniform mat4 mvp;
uniform vec4 color;
uniform sampler2D t_scape;
uniform float time;
uniform vec3 view_pos;

#define N_LIGHTS 3
uniform vec3 light_position[N_LIGHTS];
uniform vec3 light_direction[N_LIGHTS];
uniform vec3 light_direction2[N_LIGHTS];
uniform vec3 light_color[N_LIGHTS];
uniform vec2 light_falloff[N_LIGHTS];

// landscape.vertex //
vec3 get_pos(vec2 co) {
    vec3 P = 2.0 * (vec3(co.x, 0.5, co.y) - 0.5);
    //P.z *= 2.0;
    P = P * 10.0;
    float h = texture2D(t_scape, vec2(co.x, co.y + time)).r;
    P.y = 1.0 * h;
    //P.y *= 0.0;
    return P;
}

void main() {
    vec3 P = get_pos(coord);
    vec3 Pdx = normalize(get_pos(coord + vec2(1.0/256.0, 0.0)) - P);
    vec3 Pdy = normalize(get_pos(coord + vec2(0.0, 1.0/256.0)) - P);
    vec3 N = cross(Pdx, Pdy);

    gl_Position = mvp * vec4(P, 1.0);
    v_normal = -N;
    v_position = P;
}

// landscape.fragment //
vec3 toLinear(vec3 rgb) {
    return pow(rgb, vec3(2.2));
}

vec3 filmic(vec3 c) {
    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

void main() {
    // worldspace normal
    vec3 N = normalize(v_normal);
    vec3 P = v_position;
    vec3 V = normalize(view_pos - P);

    vec3 C = vec3(0.000);
    for (int i = 0; i < N_LIGHTS; ++i) {
        vec3 L = normalize(light_position[i] - P);
        float spot = dot(light_direction[i], -L);

        float a = 0.0;
        if (i > 0) {
            a = dot(light_direction2[i], -L);
        }

        float fs = light_falloff[i].x;
        float fw = light_falloff[i].y;

        //fs = mix(0.9999, 0.500, a);
        fs = 0.1;

        /*
        if (spot > fs) {
            spot = clamp((spot - fs) / fw, 0.0, 1.0);
        } else {
            spot = 0.0;
        }
        */
        if (spot < fs)
            spot = 0.0;

        //if (abs(a) > 0.01)
            spot *= smoothstep(0.030, 0.00, abs(a));

        vec3 H = normalize(L + V);
        float NdotL = max(dot(N, L), 0.0);
        float NdotH = max(dot(N, H), 0.0);

        float diffuse = NdotL;
        float specular = pow(NdotH, 90.0);
        //C += (color.rgb * diffuse + specular) * light_color[i];
        //C = 0.5 * (H + 1.0);
        C += toLinear(light_color[i]) * spot * diffuse;
        //C = (light_direction2[i]+1.0)/2.0;
    }

    gl_FragColor = vec4(filmic(C), 1.0);
    //gl_FragColor = vec4(C, 1.0);
}



// enf_background //
attribute vec2 coord;
varying vec3 v_color;
uniform vec3 color0;
uniform vec3 color1;

// enf_background.vertex //
void main() {
    gl_Position = vec4(2.0*(coord - 0.5), 0.0, 1.0);
    v_color = mix(color0, color1, coord.y);
}

// enf_background.fragment //
void main() {
    gl_FragColor = vec4(v_color, 1.0);
}
