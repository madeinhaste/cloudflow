// textest //
attribute vec3 position;
attribute vec3 normal;
attribute vec2 texcoord;

varying vec3 v_normal;
varying vec2 v_texcoord;

uniform mat4 mvp;
uniform vec4 color;

uniform samplerCube t_color;
//uniform sampler2D t_color;

// textest.vertex //
void main() {
    gl_Position = mvp * vec4(position, 1.0);
    v_normal = normal;
    v_texcoord = texcoord;
}

// textest.fragment //
#extension GL_EXT_shader_texture_lod : enable

void main() {
    vec3 N = normalize(v_normal);
    //vec3 C = textureCube(t_color, N).rgb;
    vec3 C = textureCubeLodEXT(t_color, N, 5.0).rgb;

    //vec3 C = texture2D(t_color, v_texcoord).rgb;
    gl_FragColor = vec4(C, 1.0);

    //gl_FragColor = vec4((N*0.5)+0.5, 1.0);
    //gl_FragColor = vec4(C, 1.0);
}
