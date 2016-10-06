// shoe //
attribute vec3 position;
attribute vec3 normal;
attribute vec3 tangent;
attribute vec2 texcoord;

varying vec3 v_normal;
varying vec3 v_tangent;
varying vec3 v_bitangent;
varying vec3 v_position;
varying vec2 v_texcoord;

uniform mat4 mvp;
uniform mat4 view;
uniform vec3 color;

uniform samplerCube t_iem;
uniform samplerCube t_rem;
uniform sampler2D t_color;
uniform sampler2D t_occ;
uniform sampler2D t_normal;

uniform float lod;
uniform vec3 viewpos;
uniform float f0;
uniform float normal_mix;
uniform float specular;
uniform float twist;

// shoe.vertex //
void main() {
    // rotate around X axis
    vec3 P = position;

    vec3 N = normal;
    vec3 T = tangent;
    vec3 B = cross(N, T);

    if (false) {
        float d = P.x*P.x;
        d = 0.15 + max(0.0, 0.1*d);
        float t = twist * d;
        //float t = 3.14/2.0;

        float c = cos(t);
        float s = sin(t);

        mat3 deform = mat3(
            1.0, 0.0, 0.0,
            0.0, c, -s,
            0.0, s, c);

        float y = 3.0;
        P.y -= y;
        P = deform * P;
        P.y += y;

        T = deform * T;
        B = deform * B;
        N = cross(T, B);
    }

    gl_Position = mvp * vec4(P, 1.0);

    v_normal = N;
    v_tangent = T;
    v_position = P;

    v_texcoord = texcoord;
}

// shoe.fragment //
#extension GL_EXT_shader_texture_lod : enable

float G1V(float NdotV, float k) {
    return 1.0 / (NdotV*(1.0 - k) + k);
}

vec3 toLinear(vec3 rgb) {
    return pow(rgb, vec3(2.2));
}

vec3 toAcesFilmic(vec3 rgb)
{
    // Reference:
    // ACES Filmic Tone Mapping Curve
    // https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
    float aa = 2.51;
    float bb = 0.03;
    float cc = 2.43;
    float dd = 0.59;
    float ee = 0.14;
    
    vec3 C = (rgb*(aa*rgb + bb)) / (rgb*(cc*rgb + dd) + ee);
    C.x = clamp(C.x, 0.0, 1.0);
    C.y = clamp(C.y, 0.0, 1.0);
    C.z = clamp(C.z, 0.0, 1.0);
    return C;
}

vec3 filmic(vec3 c) {
    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

void main() {
    // worldspace
    vec3 N = normalize(v_normal);

    if (true) {
        vec3 T = normalize(v_tangent);
        vec3 B = cross(N, T);
        mat3 TBN = mat3(T, B, N);   // ts -> ws

        vec3 s = texture2D(t_normal, v_texcoord).rgb;
        N = mix(N, normalize(TBN * 2.0*(s - 0.5)), normal_mix);
    }

    vec3 V = normalize(viewpos - v_position);
    vec3 R = -reflect(V, N);

    vec3 Cd = toLinear(texture2D(t_color, v_texcoord).rgb);

    vec3 Ambient = toLinear(textureCube(t_iem, N).rgb) * 5.0;
    Cd = Cd * Ambient;

    vec3 C = Cd;

    vec3 Cs = (textureCubeLodEXT(t_rem, R, lod).rgb);

    {
        float F0 = f0;
        float NdotV = max(0.0, dot(N, V));
        float NdotL = max(0.0, dot(N, R));
        float F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);
        C += specular * F * Cs;
    }


    //vec3 Cd = textureCubeLodEXT(t_iem, R, lod).rgb;
    //vec3 Cd = textureCube(t_iem, R).rgb;
    //Cd = vec3(v_texcoord, 0.0);

    float occ = texture2D(t_occ, v_texcoord).g;
    C *= occ;

    //C = Ambient;

    gl_FragColor = vec4(toAcesFilmic(C), 1.0);
    //gl_FragColor = vec4( (0.5*N) + 0.5, 1.0 );
    //gl_FragColor = vec4(C, 1.0);

    //gl_FragColor = vec4((R*0.5)+0.5, 1.0);

    //gl_FragColor = vec4(texture2D(t_normal, v_texcoord).rgb, 1.0);
}
