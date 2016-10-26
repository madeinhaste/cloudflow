// earth //
attribute vec3 position;
attribute vec3 normal;
attribute vec3 tangent;
attribute vec2 texcoord;

varying vec3 v_normal;
varying vec3 v_tangent;
varying vec3 v_position;
varying vec2 v_texcoord;

uniform mat4 mvp;
uniform mat4 model_matrix;
uniform mat3 normal_matrix;
uniform vec3 color;
uniform vec3 viewpos;
uniform sampler2D t_normal;
uniform float normal_scale;

// earth.vertex //
void main() {
    vec4 P = model_matrix * vec4(position, 1.0);
    v_normal = normal_matrix * normal;
    v_tangent = normal_matrix * tangent;
    v_position = P.xyz;
    v_texcoord = texcoord;
    gl_Position = mvp * P;
}

// earth.fragment //
#extension GL_EXT_shader_texture_lod : enable

float G1V(float NdotV, float k) { return 1.0 / (NdotV*(1.0 - k) + k); }
vec3 toLinear(vec3 rgb) { return pow(rgb, vec3(2.2)); }
vec3 toGamma(vec3 rgb) { return pow(rgb, vec3(1.0/2.2)); }
vec3 filmic(vec3 c) {
    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

void main() {
    vec3 N = normalize(v_normal);
    
    {
        vec3 T = normalize(v_tangent);
        vec3 B = cross(N, T);
        mat3 TBN = mat3(T, B, N);   // ts -> ws

        vec3 s = texture2D(t_normal, normal_scale * v_texcoord).rgb;
        float normal_mix = 1.0;
        N = mix(N, normalize(TBN * 2.0*(s - 0.5)), normal_mix);
    }

    vec3 V = normalize(viewpos - v_position);
    float NdotV = max(0.0, dot(N, V));
    vec3 C = mix(0.7, 0.4, NdotV) * color;
    gl_FragColor = vec4(C, 1.0);
}
