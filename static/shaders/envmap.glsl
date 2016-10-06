// envmap //
attribute vec3 position;
attribute vec3 normal;
attribute vec3 texcoord;

varying vec3 v_normal;
varying vec3 v_texcoord;

uniform mat4 mvp;
uniform vec4 color;
uniform samplerCube t_envmap;

// envmap.vertex //
void main() {
    gl_Position = mvp * vec4(position, 1.0);
    v_normal = normal;
    v_texcoord = texcoord;
}

// envmap.fragment //
void main() {
    vec3 N = normalize(v_normal);
    //vec3 C = textureCube(t_envmap, N).wyz;  // xGBR
    vec3 C = textureCube(t_envmap, N).rgb;
    gl_FragColor = vec4((N*0.5)+0.5, 1.0);
    gl_FragColor = vec4(C, 1.0);
}
