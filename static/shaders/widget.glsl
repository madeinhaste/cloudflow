// widget //
attribute vec3 position;
attribute vec2 texcoord;
varying vec2 v_texcoord;
varying float v_depth;

// widget.vertex //
uniform mat4 mvp;
uniform mat4 view;
uniform vec3 translate;
uniform vec4 rotate;
uniform float scale;

vec3 transform_quat(vec3 v, vec4 q) {
    vec3 t = 2.0 * cross(q.xyz, v);
    return v + q.w*t + cross(q.xyz, t);
}

void main() {
    vec3 P = position;
    P = transform_quat(P, rotate);
    P *= scale;
    P.xyz += translate;

    gl_Position = mvp * vec4(P, 1.0);
    v_texcoord = vec2(texcoord.x, 1.0-texcoord.y);

    {
        vec3 Pv = (view * vec4(P, 1.0)).xyz;
        v_depth = -Pv.z;
    }
}

// widget.fragment //
uniform sampler2D t_color;
uniform vec3 color;

uniform vec3 bg_color0;
uniform vec3 bg_color1;
uniform vec2 resolution;

vec3 fade_to_background(vec3 C) {
    float depth = clamp(0.003 * v_depth, 0.0, 1.0);
    vec3 bg_color = mix(bg_color0, bg_color1, gl_FragCoord.y/resolution.y);
    return mix(C, bg_color, depth);
}

void main() {
    vec3 C = texture2D(t_color, v_texcoord).rgb;
    gl_FragColor = vec4(color * C, 1.0);
    gl_FragColor.rgb = fade_to_background(gl_FragColor.rgb);
}
