// groove //
attribute vec2 coord;
varying vec3 v_normal;
varying vec3 v_tangent;
varying vec3 v_bitangent;
varying vec3 v_position;
varying vec2 v_coord;
varying float v_depth;

// groove.vertex //
uniform mat4 mvp;
uniform mat4 view;
uniform float time;
uniform sampler2D t_curve;

vec3 get_pos(vec2 co) {
    vec3 P;
    P.x = 20.0 * (co.x - 0.5);
    P.y = 0.5;
    P.z = 0.0;

    float center = 0.5;
    float w = 0.1;
    float width = mix(0.0, 0.1,
        smoothstep(w + 0.1, w, abs(fract(time + co.y) - 0.5)));
    float h = -smoothstep(0.08 + width, 0.02 + width, abs(co.x - center));
    P.y = h;

    //if (coord.x == 0.0) P.x -= 1000.0;
    //if (coord.x == 1.0) P.x += 1000.0;

    if (abs(P.x) > 4.0)
        P.x *= 100.0;

    {
        vec3 T = texture2D(t_curve, vec2(co.y, 0.0)).xyz;
        //vec4 Q = texture2D(t_curve, vec2(co.y, 1.0));
        //P = transform_quat(P, Q);
        //P += T;
        //P.xy += T.xy;
        //P.z += 100.0*T.z;
        P += T;
    }

    return P;
}

void main() {
    vec3 P = get_pos(coord);
    vec3 Pdx = normalize(get_pos(coord + vec2(1.0/256.0, 0.0)) - P);
    vec3 Pdy = normalize(get_pos(coord + vec2(0.0, 1.0/256.0)) - P);
    vec3 N = normalize(cross(Pdx, Pdy));

    //vec3 Pdx = vec3(-1, 0, 0);
    //vec3 Pdy = normalize(get_pos(coord + vec2(0.0, 1.0/128.0)) - P);
    v_tangent = vec3(1,0,0);
    v_bitangent = cross(v_tangent, N);

    v_normal = N;
    v_position = P;

    gl_Position = mvp * vec4(P, 1.0);

    {
        vec3 Pv = (view * vec4(P, 1.0)).xyz;
        v_depth = -Pv.z;
    }

    v_coord = 4.0 * vec2(P.x/8.0, 8.0 * coord.y + time);
}

// groove.fragment //
#extension GL_OES_standard_derivatives : enable

uniform vec3 color;
uniform vec3 view_pos;
uniform bool face_normal;

uniform vec3 bg_color0;
uniform vec3 bg_color1;
uniform vec2 resolution;

uniform sampler2D t_fabric;

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

vec3 toLinear(vec3 rgb) {
    return pow(rgb, vec3(2.2));
}

vec3 filmic(vec3 c) {
    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));
    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
}

vec3 fade_to_background(vec3 C) {
    float depth = clamp(0.003 * v_depth, 0.0, 1.0);
    vec3 bg_color = mix(bg_color0, bg_color1, gl_FragCoord.y/resolution.y);
    return mix(C, bg_color, depth);
}

void main() {
    vec3 N;
    if (face_normal) {
        vec3 Px = dFdx(v_position);
        vec3 Py = dFdy(v_position);
        N = normalize(cross(Px, Py));
    } else {
        N = normalize(v_normal);
    }

    if (true) {
        vec3 T = normalize(v_tangent);
        vec3 B = normalize(v_bitangent);
        mat3 TBN = mat3(T, B, N);   // ts -> ws
        vec3 normal = texture2D(t_fabric, v_coord).rgb;
        vec3 mapNormal = 2.0*(normal - 0.5);
        N = mix(N, normalize(TBN * mapNormal), 1.0);
    }

    vec3 V = normalize(view_pos - v_position);

    vec3 light_pos = vec3(4, 10, 3);
    vec3 L = normalize(light_pos - v_position);

    float NdotL = max(0.0, dot(N, L));
    //gl_FragColor = vec4((N + 1.0)/2.0, 1.0);

    float diffuse = mix(0.2, 1.0, NdotL);
    vec3 C = diffuse * toLinear(color);
    gl_FragColor = vec4(filmic(C), 1.0);

    //gl_FragColor.rgb = grid(v_coord, 80.0, 1.00) * C;
    gl_FragColor.rgb = fade_to_background(gl_FragColor.rgb);

    //gl_FragColor.rgb = texture2D(t_fabric, v_coord).rgb;

    // normal debug
    //gl_FragColor = vec4(0.5*(N + 1.0), 1.0);
}




// spd_background //
attribute vec2 coord;
varying vec3 v_color;

// spd_background.vertex //
uniform vec3 color0;
uniform vec3 color1;

void main() {
    gl_Position = vec4(2.0*(coord - 0.5), 0.0, 1.0);
    v_color = mix(color0, color1, coord.y);
}

// spd_background.fragment //
void main() {
    gl_FragColor = vec4(v_color, 1.0);

}
