// shoe_pick //
attribute vec3 position;
uniform mat4 mvp;
uniform mat4 model_matrix;
uniform vec4 color;

// shoe_pick.vertex //
void main() {
    vec4 P = model_matrix * vec4(position, 1.0);
    gl_Position = mvp * P;
}

// shoe_pick.fragment //
void main() {
    gl_FragColor = color;
}
