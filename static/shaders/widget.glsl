// widget //
attribute vec3 position;
attribute vec2 texcoord;

//attribute vec3 normal;
//varying vec3 v_normal;
//varying vec3 v_view;
varying vec2 v_texcoord;

uniform mat4 mvp;
uniform mat4 model_matrix;
uniform vec4 color;
uniform vec3 translate;
uniform sampler2D t_color;

uniform float time;
//uniform vec3 view_pos;

// widget.vertex //
void main() {
    vec4 P = vec4(position, 1.0);
    P = model_matrix * P;
    P.xyz += translate;

    gl_Position = mvp * P;
    //v_normal = N;
    //v_view = normalize(view_pos - P);
    v_texcoord = texcoord;
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
    gl_FragColor = vec4(C, 1.0);
}
