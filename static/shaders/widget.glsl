// widget //
attribute vec3 position;
attribute vec2 texcoord;

//attribute vec3 normal;
//varying vec3 v_normal;
//varying vec3 v_view;
varying vec2 v_texcoord;

uniform mat4 mvp;
uniform vec3 color;
uniform vec3 translate;
uniform vec4 rotate;
uniform float scale;
uniform sampler2D t_color;

uniform float time;
//uniform vec3 view_pos;

// widget.vertex //
vec3 transform_quat(vec3 v, vec4 q) {
    vec3 t = 2.0 * cross(q.xyz, v);
    return v + q.w*t + cross(q.xyz, t);
}

void main() {
    vec3 P = position;
    P = transform_quat(P, rotate);
    P *= scale;
    P.xyz += translate;

    gl_Position = mvp * vec4(P, 1.0);
    v_texcoord = vec2(texcoord.x, 1.0-texcoord.y);
}

// widget.fragment //
void main() {
    // worldspace normal
    //vec3 N = normalize(v_normal);
    //vec3 V = -normalize(v_view);
    //float NdotV = max(0.0, dot(N, V));
    //gl_FragColor = vec4((N + 1.0)/2.0, 1.0);
    //gl_FragColor = vec4(NdotV * color.rgb, 1.0);
    vec3 C = texture2D(t_color, v_texcoord).rgb;
    gl_FragColor = vec4(color * C, 1.0);
}
