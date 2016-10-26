// particles //
attribute vec4 position;

// particles.vertex //
uniform mat4 mvp;

void main() {
    vec3 P = position.xyz;
    gl_Position = mvp * vec4(P, 1.0);
    gl_PointSize = position.w;
}

// particles.fragment //
void main() {
    vec2 P = 2.0 * (gl_PointCoord.xy - 0.5);
    float alpha = 1.0 - dot(P, P);
    alpha *= 0.2;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
}
