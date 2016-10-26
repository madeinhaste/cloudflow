// cloud //
attribute vec4 position;
attribute float color;
attribute vec2 coord;

varying vec2 v_texcoord;
varying vec4 v_color;

// cloud.vertex //
uniform mat4 mvp;
uniform mat3 bill;
uniform float gradient_index;
uniform sampler2D t_gradient;
uniform float aspect;

void main() {
    vec3 P = vec3(coord, 0.0);
    P.x *= aspect;
    P = bill * P;
    float scale = position.w;

    P = position.xyz + scale * P;
    gl_Position = mvp * vec4(P, 1.0);
    gl_PointSize = scale;
    v_texcoord = vec2(coord.x, 1.0-coord.y);

    v_color = texture2D(t_gradient, vec2(color, gradient_index));
}

// cloud.fragment //
uniform sampler2D t_color;
uniform bool zpass;

void main() {
    float s = texture2D(t_color, v_texcoord).r;
    gl_FragColor = vec4(s*v_color.rgb, s);

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
