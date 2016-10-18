// cloud //
attribute vec4 position;
attribute vec4 color;
attribute vec2 coord;

varying vec2 v_texcoord;
varying vec4 v_color;

uniform mat4 mvp;
uniform mat3 bill;
//uniform vec4 color;
uniform sampler2D t_color;
uniform float aspect;

// cloud.vertex //
void main() {
    vec3 P = vec3(coord, 0.0);
    P.x *= aspect;
    P = bill * P;
    float scale = position.w;

    P = position.xyz + scale * P;
    gl_Position = mvp * vec4(P, 1.0);
    gl_PointSize = scale;
    v_texcoord = coord;
    v_color = color;
}

// cloud.fragment //
void main() {
    float s = texture2D(t_color, v_texcoord).r;
    //gl_FragColor = vec4(1.0, 1.0, 1.0, 0.30 * s);
    gl_FragColor = v_color;
    gl_FragColor.a *= s;
    //vec4(1.0, 1.0, 1.0, 0.30 * s);
}