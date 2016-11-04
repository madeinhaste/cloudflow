// cube //
attribute vec3 position;
attribute vec3 normal;

varying vec3 v_normal;
varying vec3 v_position;

// cube.vertex //
uniform mat4 mvp;
uniform mat4 model_matrix;
uniform mat3 normal_matrix;
uniform float scale;

void main() {
    vec4 P = model_matrix * vec4(scale * position, 1.0);
    v_normal = normal_matrix * normal;
    v_position = P.xyz;
    gl_Position = mvp * P;
}

// cube.fragment //
#extension GL_EXT_shader_texture_lod : enable

uniform samplerCube t_iem;
uniform samplerCube t_rem;
uniform vec3 viewpos;

vec3 filmic(vec3 c) {
    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

vec3 toLinear(vec3 rgb) {
    return pow(rgb, vec3(2.2));
}

vec3 decode_rgbm(vec4 rgbm) {
    return 6.0 * rgbm.rgb * rgbm.a;
}

void main() {
    vec3 V = normalize(viewpos - v_position);
    vec3 N = normalize(v_normal);
    vec3 R = -reflect(V, N);

    vec3 Cd = vec3(0.50);
    vec3 Ambient = decode_rgbm(textureCube(t_iem, -N));
    vec3 C = Ambient * Cd;

    if (true) {
        float F0 = 0.03;
        float NdotV = max(0.0, dot(N, V));
        float F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);
        float lod = 5.0;
        vec3 Cs = toLinear(decode_rgbm(textureCube(t_rem, R)));
        C += 0.8 * F * Cs;
    }

    gl_FragColor = vec4(filmic(C), 1.0);
}
