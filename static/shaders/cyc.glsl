// cyc //
attribute vec3 position;
attribute vec2 texcoord;
varying vec2 v_texcoord;
uniform mat4 mvp;
uniform sampler2D t_color;

// cyc.vertex //
void main() {
    gl_Position = mvp * vec4(position, 1.0);
    v_texcoord = texcoord;
}

// cyc.fragment //
void main() {
    vec3 C = texture2D(t_color, v_texcoord).rgb;
    gl_FragColor = vec4(C, 1.0);
}
