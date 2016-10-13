// tunnel //
attribute vec2 coord;
varying vec2 v_coord;
uniform mat4 mvp;
uniform vec4 color;
uniform sampler2D t_frames;
uniform float time;
uniform float radius;

uniform vec2 warp;

// tunnel.vertex //
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

// Classic Perlin noise, periodic variant
float pnoise(vec2 P, vec2 rep) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod(Pi, rep.xyxy); // To create noise with explicit period
  Pi = mod289(Pi);        // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;

  vec4 i = permute(permute(ix) + iy);

  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
  vec4 gy = abs(gx) - 0.5 ;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;

  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);

  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x;  
  g01 *= norm.y;  
  g10 *= norm.z;  
  g11 *= norm.w;  

  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));

  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

vec3 transform_quat(vec3 v, vec4 q) {
    vec3 t = 2.0 * cross(q.xyz, v);
    return v + q.w*t + cross(q.xyz, t);
}

void main() {
    const float PI = 3.14159265359;
    const float TWO_PI = 2.0 * PI;

    vec3 P;
    float theta = TWO_PI * coord.x;
    float r = radius * mix(1.0, 0.0, coord.y);

    //r += 1.5 * pnoise(vec2(time + coord.x*16.0, coord.y*680), vec2(16.0, 16.0));
    r += 0.2 * pnoise(vec2(coord.x*16.0, (coord.y + time) * 16.0), vec2(16.0, 16.0));

    P.x = r * cos(theta);
    P.y = r * sin(theta);
    P.z = 0.0;

    {
        vec3 T = texture2D(t_frames, vec2(coord.y, 0.0)).xyz;
        vec4 Q = texture2D(t_frames, vec2(coord.y, 1.0));
        P = transform_quat(P, Q);
        P += T;
    }

    gl_Position = mvp * vec4(P, 1.0);
    v_coord = vec2(coord.x, coord.y + time);
}

// tunnel.fragment //
void main() {
#ifdef INNER
    float u = v_coord.x;
    float theta = warp.y * v_coord.y;
    u += warp.x * sin(theta);

    float z = 2.0 * abs(fract(64.0*u) - 0.5);
    z = smoothstep(0.5, 1.0, z);
    if (z == 0.0)
        discard;

    vec3 C0 = vec3(0, 0, 1);
    vec3 C1 = vec3(0, 1, 0.5);
    float w = 2.0 * abs(fract(v_coord.y) - 0.5);

    vec3 C = z * mix(C0, C1, w);
    //vec3 C = vec3(0, 0, 1.0 * z);
    gl_FragColor = vec4(C, z);
#else
    vec3 C0 = vec3(1, 1, 0);
    vec3 C1 = vec3(1, 0, 1);

    float z = 2.0 * abs(fract(v_coord.y) - 0.5);
    vec3 C = mix(C0, C1, z);

    {
        // dots
        vec2 c = fract(v_coord * vec2(64.0, 20.0));
        float s = length(0.5 - c);
        if (s < 0.10)
            C = vec3(0, 0, 1);
    }

    gl_FragColor = vec4(C, 1.0);
#endif
}
