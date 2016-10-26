// grid //
attribute vec2 position;

// grid.vertex //
uniform mat4 mvp;

void main() {
    gl_Position = mvp * vec4(position.x, 0, position.y, 1);
}

// grid.fragment //
uniform vec4 color;

void main() {
    gl_FragColor = color;
}


// simple //
attribute vec3 position;

// simple.vertex //
uniform mat4 mvp;

void main() {
    gl_Position = mvp * vec4(position, 1.0);
    gl_PointSize = 3.0;
}

// simple.fragment //
uniform vec4 color;

void main() {
    gl_FragColor = color;
}



// blit //
attribute vec2 coord;
varying vec2 v_coord;
uniform float alpha;
uniform sampler2D s_rgba;

// blit.vertex //
void main() {
    v_coord = coord;
    gl_Position = vec4(2.0*(coord - 0.5), 0.0, 1.0);
}

// blit.fragment //
void main() {
    gl_FragColor = texture2D(s_rgba, v_coord);
    gl_FragColor.a = alpha;
}


// pick_readback //
attribute vec2 coord;
varying vec2 v_coord;
uniform sampler2D s_depth;

// pick_readback.vertex //
void main() {
    v_coord = coord;
    gl_Position = vec4(2.0*(coord - 0.5), 0.0, 1.0);
}

// pick_readback.fragment //
void main() {
    float d = texture2D(s_depth, v_coord).r;
    gl_FragColor = vec4(d, 0.0, 0.0, 1.0);
}
