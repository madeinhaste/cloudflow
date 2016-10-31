// meshflow //
attribute vec2 coord;
varying vec2 v_texcoord;
varying vec3 v_position;
varying vec3 v_normal;
varying vec3 v_tangent;
varying vec3 v_bitangent;

// meshflow.vertex //
uniform mat4 mvp;
uniform vec3 translate;

vec3 get_pos(vec2 co) {
    vec3 P = vec3(
        4.0 * (co.x - 0.5),
        0.0,
        2.0 * (co.y - 0.5));

    float y = 1.0 - co.y;
    P.y = 3.0 * y * y;
    return P;
}

void main() {
    vec3 P = get_pos(coord);
    //vec3 Pdx = get_pos(coord + vec2(1.0/128.0, 0.0)) - P;
    vec3 Pdx = vec3(-1, 0, 0);
    vec3 Pdy = normalize(get_pos(coord + vec2(0.0, 1.0/128.0)) - P);

    v_tangent = Pdx;
    v_bitangent = Pdy;
    vec3 N = normalize(cross(Pdx, Pdy));
    v_normal = N;

    P *= 10.0;
    P += translate;

    gl_Position = mvp * vec4(P, 1.0);
    v_position = P;

    {
        vec2 co = coord;
        //float y = coord.y;
        //co.x = 2.0 * (co.x - 0.5) * mix(1.0, 1.0, y);
        //co.x = 0.5 * (co.x + 1.0);
        v_texcoord = co;
    }
}

// meshflow.fragment //
uniform float time;
uniform float drift;
uniform sampler2D t_fabric;
uniform vec3 color0;
uniform vec3 color1;
uniform vec3 light_pos;
uniform vec3 view_pos;

float hole(vec2 co, float size) {
    const float PI = 3.141592653589793;
    float s2 = 0.5 + (sin(2.0 * PI * 2.0 * co.y) * 0.5);

    vec2 uv = co;
    float ox = 0.0;
    //uv.y -= 0.200;
    if (fract(4.0*uv.y) > 0.5) {
        //uv.x += 0.125;
        size *= 1.5;
        ox = 0.5;
    }

    uv *= vec2(8.0, 2.0);

    uv.x += ox;
    uv = fract(8.0 * uv);

    uv = abs(uv - 0.5);
    uv.x *= 1.0;
    uv *= size;

    uv *= mix(1.0, 2.0, s2);
    return step(0.05, dot(uv, uv));
}

vec3 filmic(vec3 c) {
    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

vec3 toLinear(vec3 rgb) {
    return pow(rgb, vec3(2.2));
}

float fresnel(vec3 H, vec3 V, float f0) {
    float base = 1.0 - dot(V, H);
    float exponent = pow(base, 5.0);
    return exponent + f0*(1.0 - exponent);
}

vec3 lighting(vec3 normal, vec3 color) {
    vec3 V = normalize(view_pos - v_position);
    vec3 N = normalize(v_normal);
    vec3 R = -reflect(V, N);
    vec3 L = normalize(light_pos - v_position);
    vec3 H = normalize(L + V);

    if (true) {
        vec3 T = normalize(v_tangent);
        vec3 B = normalize(v_bitangent);
        mat3 TBN = mat3(T, B, N);   // ts -> ws
        vec3 mapNormal = 2.0*(normal - 0.5);
        N = mix(N, normalize(TBN * mapNormal), 1.0);
    }

    float NdotL = max(dot(N, L), 0.0);
    float NdotH = max(dot(N, H), 0.0);

    vec3 Cd = NdotL * toLinear(color);
    vec3 Cs = vec3(0.0);

    /*
    {
        float F0 = 0.03;
        float NdotV = max(0.0, dot(N, V));
        float F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);
        Cs = F * vec3(0.5);
    }
    */

    if (false) {
        float specular = pow(NdotH, 20.0);
        //specular *= 0.25;
        specular *= mix(0.25, fresnel(H, V, 0.028), 0.5);
        Cs = vec3(1.0) * specular;
    }

    return filmic(Cd + Cs);

    //vec3 T = normalize(v_tangent);
    //vec3 B = normalize(v_bitangent);
    //gl_FragColor = vec4(0.5*(N+1.0), 1.0);
    //gl_FragColor.rgb = filmic(Cd + Cs);
}

void main() {
    vec2 co = v_texcoord;
    co.y -= time;
    co.x += drift;

#if defined(STRIPES)
    float x = fract(128.0 * co.x);
    x = abs(x - 0.5);
    x = 1.0 - smoothstep(0.1, 0.110, x);
    vec3 color = vec3(0.02, 0.00, 0.10);
    float alpha = x;
    gl_FragColor = vec4(color, alpha);
#elif defined(BACKGROUND)
    vec4 C = texture2D(t_fabric, 16.0 * co);
    vec3 color = mix(color1, color0, pow(1.8*C.a, 0.5));
    //vec3 color = C.rgb;
    float h = hole(co, 0.7);
    color *= mix(1.0, 0.5, h);
    float alpha = 1.0;
    gl_FragColor = vec4(lighting(C.rgb, color), alpha);
#elif defined(MESH)
    vec4 C = texture2D(t_fabric, 8.0 * co);
    vec3 color = mix(color1, color0, pow(1.8*C.a, 0.5));
    float h = hole(co, 1.0);
    float alpha = h;
    gl_FragColor = vec4(lighting(C.rgb, color), alpha);
#endif
}
