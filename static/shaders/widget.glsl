// widget //
attribute vec3 position;
attribute vec2 texcoord;
varying vec2 v_texcoord;

// widget.vertex //
uniform mat4 mvp;
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
}

// widget.fragment //
uniform sampler2D t_color;
uniform vec3 color;

void main() {
    vec3 C = texture2D(t_color, v_texcoord).rgb;
    gl_FragColor = vec4(color * C, 1.0);
}
