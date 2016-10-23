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
uniform vec3 color;

uniform samplerCube t_iem;
uniform samplerCube t_rem;
uniform sampler2D t_color;

uniform sampler2D t_normal;

uniform float lod;
uniform vec3 viewpos;
uniform float f0;
uniform float normal_mix;
uniform float normal_scale;
uniform float specular;
uniform float ambient;
uniform float occlusion;
uniform bool use_normal2;
uniform vec3 id_blend;

uniform float time;

// shoe2.vertex //
void main() {
    vec4 P = model_matrix * vec4(position, 1.0);
    v_normal = normal_matrix * normal;
    v_tangent = normal_matrix * tangent;
    v_position = P.xyz;
    v_texcoord = vec2(texcoord.x, 1.0 - texcoord.y);
    gl_Position = mvp * P;
}

// shoe2.fragment //
#extension GL_EXT_shader_texture_lod : enable
#extension GL_OES_standard_derivatives : enable

float G1V(float NdotV, float k) {
    return 1.0 / (NdotV*(1.0 - k) + k);
}

vec3 toLinear(vec3 rgb) {
    return pow(rgb, vec3(2.2));
}

vec4 toLinear(vec4 rgba) {
    return pow(rgba, vec4(2.2));
}

vec3 toGamma(vec3 rgb) {
    return pow(rgb, vec3(1.0/2.2));
}


vec3 filmic(vec3 c) {
    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

float grid(vec2 coord, float size, float width) {
    // http://www.gamedev.net/topic/529926-terrain-contour-lines-using-pixel-shader/
    // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
    float gsize = 128.0;
    float gwidth = 0.5;
    vec2 P = coord;
    vec2 f = abs(fract(P * gsize)-0.5);
    vec2 df = fwidth(P * gsize);
    float mi = max(0.0, gwidth-1.0);
    float ma = max(1.0, gwidth); //should be uniforms
    vec2 g = clamp((f - df*mi) / (df * (ma-mi)), max(0.0, 1.0-gwidth), 1.0); // max(0.0,1.0-gwidth) should also be sent as uniform
    return 2.0 * ((1.0 - g.x) + (1.0 - g.y));
}

void main() {
    float alpha = 1.0;
    float id = 0.0;

    // worldspace
    vec3 N = normalize(v_normal);

#ifdef NORMAL_MAP
    {
        vec3 T = normalize(v_tangent);
        vec3 B = cross(N, T);
        mat3 TBN = mat3(T, B, N);   // ts -> ws

        vec4 s = texture2D(t_normal, normal_scale * v_texcoord).rgba;
        vec3 mapNormal;
        if (use_normal2) {
            vec3 N;
            N.xy = 2.0*(s.rg - 0.5);
            N.z = sqrt(1.0 - N.x*N.x + N.y*N.y);
            mapNormal = N;
        } else {
            mapNormal = 2.0*(s.rgb - 0.5);
        }

        N = mix(N, normalize(TBN * mapNormal), normal_mix);
        id = s.a;
    }
#endif

    vec3 V = normalize(viewpos - v_position);
    vec3 R = -reflect(V, N);

    // output color
    vec3 C = vec3(0.0);

    // diffuse part
    float occ;
    vec3 Cd;

    {
        vec4 Cd_tex = toLinear(texture2D(t_color, v_texcoord));

        //vec2 grid_co = vec2(v_texcoord.x+time, v_texcoord.y);
        vec2 grid_co = v_texcoord;

        vec3 Cd_grid = mix(vec3(0.3), vec3(1.0), grid(grid_co, 128.0, 0.5));

        float grid_blend = 0.0;

        float id_edge = 0.20;

        {
            // id1
            float x = abs(id - 0.5);
            x = smoothstep(id_edge, 0.0, x);
            grid_blend += id_blend[1] * x;
        }

        {
            // id2
            float x = abs(id - 1.0);
            x = smoothstep(id_edge, 0.0, x);
            grid_blend += id_blend[2] * x;
        }

        // id3
        grid_blend += id_blend[0];
        grid_blend = min(1.0, grid_blend);

        Cd = mix(Cd_tex.rgb, Cd_grid, grid_blend);
        occ = mix(1.0, Cd_tex.a, occlusion);
    }

    vec3 Ambient = (textureCube(t_iem, -N).rgb) * ambient;
    C += Ambient * occ * Cd;

    if (true) {
        float F0 = f0;
        float NdotV = max(0.0, dot(N, V));
        float NdotL = max(0.0, dot(N, R));
        float F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);

#if HAVE_TEXLOD
        vec3 Cs = toLinear(textureCubeLodEXT(t_rem, R, lod).rgb);
#else
        vec3 Cs = toLinear(textureCube(t_rem, R).rgb);
#endif

        C += occ * specular * F * Cs;
    }

    gl_FragColor = vec4(alpha * filmic(C), alpha);
    //gl_FragColor = vec4(vec3(id), alpha);
}
