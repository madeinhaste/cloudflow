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





// arc2 //
attribute vec3 position0;
attribute vec4 rotation0;
attribute vec3 position1;
attribute vec4 rotation1;
attribute vec3 coord;

varying vec3 v_normal;
varying vec3 v_position;

uniform mat4 mvp;
uniform vec4 color;
uniform vec3 view_pos;



#define N_LIGHTS 3
uniform vec3 light_position[N_LIGHTS];
uniform vec3 light_direction[N_LIGHTS];
uniform vec3 light_direction2[N_LIGHTS];
uniform vec3 light_color[N_LIGHTS];
uniform vec2 light_falloff[N_LIGHTS];


// arc2.vertex //
vec3 transform_quat(vec3 v, vec4 q) {
    vec3 t = 2.0 * cross(q.xyz, v);
    return v + q.w*t + cross(q.xyz, t);
}

void main() {
    float u = coord.z;
    vec4 Q = mix(rotation0, rotation1, u);
    vec3 N = transform_quat(vec3(coord.xy, 0.0), Q);

    float radius = 0.1;
    vec3 P = mix(position0, position1, u) + radius * N;
    v_normal = N;
    v_position = P;

    gl_Position = mvp * vec4(P, 1.0);
}

// arc2.fragment //
vec3 toLinear(vec3 rgb) {
    return pow(rgb, vec3(2.2));
}

vec3 filmic(vec3 c) {
    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

void main() {
    vec3 N = normalize(v_normal);
    vec3 P = v_position;
    vec3 V = normalize(view_pos - P);

    vec3 C = vec3(0.001);
    for (int i = 0; i < N_LIGHTS; ++i) {
        vec3 L = normalize(light_position[i] - P);
        float spot = dot(light_direction[i], -L);

        float a = dot(light_direction2[i], -L);

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
}
