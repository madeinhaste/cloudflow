// shoe_pick2 //
attribute vec3 position;
attribute vec2 texcoord;
varying vec2 v_texcoord;

// shoe_pick2.vertex //
uniform mat4 mvp;
uniform mat4 model_matrix;

void main() {
    vec4 P = model_matrix * vec4(position, 1.0);
    gl_Position = mvp * P;
    v_texcoord = vec2(texcoord.x, 1.0 - texcoord.y);
}

// shoe_pick2.fragment //
uniform sampler2D t_id;
uniform vec3 color;

void main() {
    float id = texture2D(t_id, v_texcoord).a;
    gl_FragColor = vec4(id * color, 1.0);
}
