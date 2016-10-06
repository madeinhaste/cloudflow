// funworld //
attribute vec3 position;
varying vec3 v_normal;
uniform mat4 mvp;

// funworld.vertex //
void main() {
    gl_Position = mvp * vec4(position, 1.0);
    v_normal = normalize(position);
}

// funworld.fragment //
void main() {
    vec3 N = normalize(v_normal);

    vec3 ground = vec3(170.0/255.0, 0.0, 255.0);
    vec3 horizon = vec3(57.0/255.0, 112.0/255.0, 195.0/255.0);
    vec3 zenith = vec3(85.0/255.0, 230.0/255.0, 230.0/255.0);

    vec3 C;
    if (N.y < 0.0)
        C = ground;
    else {
        C = mix(horizon, zenith, pow(N.y, 0.2));
    }

    //gl_FragColor = vec4((N*0.5)+0.5, 1.0);
    gl_FragColor = vec4(C, 1.0);
}
