// cube //
attribute vec3 position;
attribute vec3 normal;

varying vec3 v_normal;
varying vec3 v_position;

uniform mat4 mvp;
uniform mat4 model_matrix;
uniform mat3 normal_matrix;
uniform vec3 color;
uniform samplerCube t_iem;
uniform samplerCube t_rem;
uniform vec3 viewpos;
uniform float scale;

// cube.vertex //
void main() {
    vec4 P = model_matrix * vec4(scale * position, 1.0);
    v_normal = normal_matrix * normal;
    v_position = P.xyz;
    gl_Position = mvp * P;
}

// cube.fragment //
#extension GL_EXT_shader_texture_lod : enable

vec3 filmic(vec3 c) {
    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

vec3 toLinear(vec3 rgb) {
    return pow(rgb, vec3(2.2));
}

void main() {
    vec3 V = normalize(viewpos - v_position);
    vec3 N = normalize(v_normal);
    vec3 R = -reflect(V, N);

    vec3 C = vec3(0.0);
    vec3 Cd = vec3(0.50);
    vec3 Ambient = textureCube(t_iem, -N).rgb;
    C += Ambient * Cd;

    if (true) {
        float F0 = 0.03;
        float NdotV = max(0.0, dot(N, V));
        float F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);
        float lod = 5.0;
        vec3 Cs = toLinear(textureCubeLodEXT(t_rem, R, lod).rgb);
        //C += vec3(0.35) * F;
        //C += vec3(0.001) * F;
        C += 0.8 * F * Cs;
    }

    gl_FragColor = vec4(filmic(C), 1.0);
    //gl_FragColor = vec4((N+1.0)/2.0, 1.0);
}
