// shoe_pick //
attribute vec3 position;
attribute vec2 texcoord;
varying vec2 v_texcoord;
uniform mat4 mvp;
uniform mat4 model_matrix;
//uniform vec4 color;
uniform sampler2D t_color;

// shoe_pick.vertex //
void main() {
    vec4 P = model_matrix * vec4(position, 1.0);
    gl_Position = mvp * P;
    v_texcoord = texcoord;
}

// shoe_pick.fragment //
void main() {
    vec3 C = texture2D(t_color, v_texcoord).rgb;
    gl_FragColor = vec4(C, 1.0);
}
