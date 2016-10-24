// meshflow //
attribute vec2 coord;
varying vec2 v_texcoord;
uniform mat4 mvp;

uniform sampler2D t_fabric;

uniform float time;
uniform float drift;
uniform vec3 translate;

uniform vec3 color0;
uniform vec3 color1;

// meshflow.vertex //
void main() {
    vec3 P = vec3(
        4.0 * (coord.x - 0.5),
        0.0,
        2.0 * (coord.y - 0.5));

    float y = 1.0 - coord.y;
    P.y = 3.0 * y * y;

    P *= 10.0;
    P += translate;

    gl_Position = mvp * vec4(P, 1.0);
    v_texcoord = coord;
}

// meshflow.fragment //
float hole(vec2 co, float size) {
    const float PI = 3.141592653589793;
    float s2 = 0.5 + (sin(2.0 * PI * 2.0 * co.y) * 0.5);

    vec2 uv = co;
    float ox = 0.0;
    //uv.y -= 0.200;
    if (fract(4.0*uv.y) > 0.5) {
        //uv.x += 0.125;
        size *= 1.5;
        ox = 0.5;
    }

    uv *= vec2(8.0, 2.0);

    uv.x += ox;
    uv = fract(8.0 * uv);

    uv = abs(uv - 0.5);
    uv.x *= 1.0;
    uv *= size;

    uv *= mix(1.0, 2.0, s2);
    return step(0.05, dot(uv, uv));
}

void main() {
    vec2 co = v_texcoord;
    co.y -= time;
    co.x += drift;

#if defined(STRIPES)
    float x = fract(128.0 * co.x);
    x = abs(x - 0.5);
    x = 1.0 - smoothstep(0.1, 0.110, x);
    vec3 color = vec3(0.02, 0.00, 0.10);
    float alpha = x;
    gl_FragColor = vec4(color, alpha);
#elif defined(BACKGROUND)
    vec4 C = texture2D(t_fabric, 4.0 * co);
    vec3 color = mix(color1, color0, C.r);
    float h = hole(co, 0.7);
    color *= mix(0.5, 1.0, h);
    float alpha = 1.0;
    gl_FragColor = vec4(color, alpha);
#elif defined(MESH)
    vec4 C = texture2D(t_fabric, co);
    vec3 color = mix(color1, color0, C.r);
    float h = hole(co, 1.0);
    float alpha = h;
    gl_FragColor = vec4(color, alpha);
#endif

}
