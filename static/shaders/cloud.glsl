// cloud //
attribute vec4 position;
attribute float color;
attribute vec2 coord;

varying vec2 v_texcoord;
varying vec4 v_color;
varying float v_depth;

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
    v_depth = gl_Position.z * gl_Position.w;
}

// cloud.fragment //
uniform sampler2D t_color;
uniform bool zpass;

void main() {
    float fade = clamp(50.0 * v_depth, 0.0, 1.0);
    fade = 1.0 - fade;
    fade *= fade;
    fade = 1.0 - fade;

    //vec3 C = mix(vec3(1,0,0), vec3(0,1,0), fade);
    //gl_FragColor = vec4(C, 1.0);
    //return;

    float s = fade * texture2D(t_color, v_texcoord).r;
    if (s < 1.0/256.0) discard;

    gl_FragColor = vec4(s*v_color.rgb, s);
}
