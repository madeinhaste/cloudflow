// shoe2 //
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
uniform mat4 view;
uniform vec3 color;

uniform samplerCube t_iem;
uniform samplerCube t_rem;
uniform sampler2D t_color;

#ifdef AMBOCC_MAP
uniform sampler2D t_occ;
#endif

uniform sampler2D t_normal;

#ifdef HIGHLIGHT
uniform sampler2D t_id;
//uniform sampler2D t_alpha;
uniform vec3 highlight_id;
uniform mat3 highlight_mat;
uniform float highlight_alpha;
#endif

uniform float lod;
uniform vec3 viewpos;
uniform float f0;
uniform float normal_mix;
uniform float normal_scale;
uniform float specular;
uniform float ambient;

// shoe2.vertex //
void main() {
    vec4 P = model_matrix * vec4(position, 1.0);
    v_normal = normal_matrix * normal;
    v_tangent = normal_matrix * tangent;
    v_position = P.xyz;
    v_texcoord = texcoord;
    gl_Position = mvp * P;
}

// shoe2.fragment //
#extension GL_EXT_shader_texture_lod : enable

float G1V(float NdotV, float k) {
    return 1.0 / (NdotV*(1.0 - k) + k);
}

vec3 toLinear(vec3 rgb) {
    return pow(rgb, vec3(2.2));
}

vec3 toGamma(vec3 rgb) {
    return pow(rgb, vec3(1.0/2.2));
}


vec3 filmic(vec3 c) {
    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

void main() {
    float alpha = 1.0;

#ifdef HIGHLIGHT
    if (highlight_id != vec3(0.0)) {
        vec3 id = texture2D(t_id, v_texcoord).rgb;
        if (id != highlight_id) discard;
        //alpha = texture2D(t_alpha, v_texcoord).g;
        alpha = highlight_alpha;
    }
#endif

    // worldspace
    vec3 N = normalize(v_normal);

#ifdef NORMAL_MAP
    {
        vec3 T = normalize(v_tangent);
        vec3 B = cross(N, T);
        mat3 TBN = mat3(T, B, N);   // ts -> ws

        vec3 s = texture2D(t_normal, normal_scale * v_texcoord).rgb;
        N = mix(N, normalize(TBN * 2.0*(s - 0.5)), normal_mix);
    }
#endif

    vec3 V = normalize(viewpos - v_position);
    vec3 R = -reflect(V, N);

    // output color
    vec3 C = vec3(0.0);

    // diffuse part
    vec3 Cd = toLinear(texture2D(t_color, v_texcoord).rgb);
    vec3 Ambient = (textureCube(t_iem, -N).rgb) * ambient;
    C += Ambient * Cd;

    if (true) {
        float F0 = f0;
        float NdotV = max(0.0, dot(N, V));
        float NdotL = max(0.0, dot(N, R));
        float F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);

#ifdef HIGHLIGHT
        R = highlight_mat * R;
#endif

#if HAVE_TEXLOD
        vec3 Cs = toLinear(textureCubeLodEXT(t_rem, R, lod).rgb);
#else
        vec3 Cs = toLinear(textureCube(t_rem, R).rgb);
#endif

        C += specular * F * Cs;

#ifdef HIGHLIGHT
        C = Cs;
#endif

    }

#ifdef AMBOCC_MAP
    float occ = texture2D(t_occ, v_texcoord).g;
    occ = pow(occ, 2.2);
    C *= occ;
#endif

    gl_FragColor = vec4(alpha * filmic(C), alpha);
}
