// shoe2 //
attribute vec3 position;
attribute vec3 normal;
attribute vec3 tangent;
attribute vec2 texcoord;

varying vec3 v_normal;
varying vec3 v_tangent;
varying vec3 v_position;
varying vec2 v_texcoord;

// shoe2.vertex //
uniform mat4 mvp;
uniform mat4 model_matrix;
uniform mat3 normal_matrix;

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

uniform vec3 color;
uniform samplerCube t_iem;
uniform samplerCube t_rem;
uniform sampler2D t_color;
uniform sampler2D t_normal;
uniform sampler2D t_noise;

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
uniform vec2 resolution;


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

float edgeFactor(vec2 co){
    vec2 d = fwidth(co);
    vec2 a3 = smoothstep(vec2(0.0), d*1.5, co);
    return min(a3.x, a3.y);
}

float grid(vec2 coord, float gsize, float gwidth) {
    // http://www.gamedev.net/topic/529926-terrain-contour-lines-using-pixel-shader/
    // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
    vec2 P = coord;
    vec2 f = abs(fract(P * gsize)-0.5);
    vec2 df = gsize * fwidth(P);
    float mi = max(0.0, gwidth-1.0);
    float ma = max(1.0, gwidth); //should be uniforms
    vec2 g = clamp((f - df*mi) / (df * (ma-mi)), max(0.0, 1.0-gwidth), 1.0); // max(0.0,1.0-gwidth) should also be sent as uniform
    float result = 2.0 * ((1.0 - g.x) + (1.0 - g.y));
    return result;
}

float rgb_to_luminance(vec3 rgb) {
    const vec3 Y = vec3(0.2126, 0.7152, 0.0722);
    return dot(rgb, Y);
}

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }

float specular_occlusion(vec3 dNormalW, vec3 dViewDirW, float dAo) {
    float material_occludeSpecularIntensity = 1.0;
    float dGlossiness = 0.8;
    float specPow = exp2(dGlossiness * 11.0);
    float specOcc = saturate(pow(dot(dNormalW, dViewDirW) + dAo, 0.01*specPow) - 1.0 + dAo);
    specOcc = mix(1.0, specOcc, material_occludeSpecularIntensity);
    return specOcc;
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
        //Cd_tex.rgb = vec3(rgb_to_luminance(Cd_tex.rgb));

        //vec2 grid_co = vec2(v_texcoord.x+time, v_texcoord.y);
        vec2 grid_co = v_texcoord;

        vec3 Cd_grid = mix(vec3(0.3), vec3(0.50), grid(grid_co, 80.0, 0.80));

        float grid_blend = 0.0;

        float id_edge = 0.50;

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
        //grid_blend = min(1.0, grid_blend);

        if (true) {
            //vec2 co = 4.0 * gl_FragCoord.xy / resolution;
            float z = 1.0 / 2.5;
            vec2 co1 = z * 4.0 * vec2(v_texcoord.x, v_texcoord.y + time);
            vec2 co2 = z * 8.0 * vec2(v_texcoord.x + time, v_texcoord.y);
            float noise = mix(texture2D(t_noise, co1).r, texture2D(t_noise, co2).g, 0.5);
            //float noise = texture2D(t_noise, co1).g;

            grid_blend = (grid_blend + noise) * 0.5;
            grid_blend = step(0.50, grid_blend);
        }

        Cd = mix(Cd_tex.rgb, Cd_grid, grid_blend);
        //Cd = vec3(grid_blend);

        occ = mix(1.0, Cd_tex.a, occlusion);
        //occ = 1.0;
    }

    vec3 Ambient = (textureCube(t_iem, -N).rgb) * ambient;
    Ambient = vec3(rgb_to_luminance(Ambient));
    
    Cd = occ * Ambient * Cd;

    vec3 Cs = vec3(0.0);
    if (true) {
        float F0 = f0;
        float NdotV = max(0.0, dot(N, V));
        float F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);

#ifdef HAVE_TEXLOD
        Cs = toLinear(textureCubeLodEXT(t_rem, R, lod).rgb);
#else
        Cs = toLinear(textureCube(t_rem, R, 3.0).rgb);
#endif

        Cs = vec3(rgb_to_luminance(Cs));

        float spec_occ = specular_occlusion(N, V, occ);
        Cs = F * spec_occ * Cs;
    }

    //C =  mix(Cd, Cs, specular);
    C = Cd + specular * Cs;

    gl_FragColor = vec4(alpha * filmic(C), alpha);
    //gl_FragColor = vec4(vec3(id), alpha);

}
