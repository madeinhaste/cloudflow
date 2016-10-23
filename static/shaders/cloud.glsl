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
uniform bool zpass;

// cloud.vertex //
void main() {
    vec3 P = vec3(coord, 0.0);
    P.x *= aspect;
    P = bill * P;
    float scale = position.w;

    P = position.xyz + scale * P;
    gl_Position = mvp * vec4(P, 1.0);
    gl_PointSize = scale;
    v_texcoord = vec2(coord.x, 1.0-coord.y);
    v_color = color;
}

// cloud.fragment //
void main() {
    float s = texture2D(t_color, v_texcoord).r;
    gl_FragColor = vec4(v_color.rgb, s);

    /*
    if (zpass) {
        if (s != 1.0) discard;
        gl_FragColor = vec4(v_color.rgb, 1.0);
    } else {
        if (s == 1.0) discard;
        gl_FragColor = vec4(v_color.rgb, s);
    }
    */
}
