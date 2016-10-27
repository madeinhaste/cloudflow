// background //
attribute vec2 coord;
varying vec3 v_color;

// background.vertex //
uniform vec3 color0;
uniform vec3 color1;

void main() {
    gl_Position = vec4(2.0*(coord - 0.5), 0.0, 1.0);
    v_color = mix(color0, color1, coord.y);
}

// background.fragment //
void main() {
    gl_FragColor = vec4(v_color, 1.0);
}
