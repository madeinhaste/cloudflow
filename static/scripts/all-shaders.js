var cloudflow_shaders = {"arc2":"attribute vec2 coord;   // u coord\nattribute vec3 position; // circle coords (x, y, u)\nvarying vec3 v_normal;\nvarying vec3 v_position;\n","arc2.vertex":"uniform mat4 mvp;\nuniform vec4 arc;       // arc params\nuniform float radius;       // arc params\nuniform float time;\nuniform float z_offset;\n\nvec3 transform_quat(vec3 v, vec4 q) {\n    vec3 t = 2.0 * cross(q.xyz, v);\n    return v + q.w*t + cross(q.xyz, t);\n}\n\nvec3 evaluate_arc(float u) {\n    float z = arc.z + 2.0 * time;\n    float x = fract(0.3*u + z);\n    float y = 1.0 - pow(2.0*(x - 0.5), 2.0);\n    y *= arc.w;\n    y += arc.y;\n    vec3 P = vec3(arc.x, y, 3.0 * u);\n    P.z += arc.z + z_offset;\n    return P;\n}\n\nvoid main() {\n    vec3 P;\n    vec3 N;\n\n    {\n        float du = 1.0/256.0;\n        float u = coord.x + du * position.z;\n        vec3 P0 = evaluate_arc(u - du);\n        vec3 P1 = evaluate_arc(u);\n        vec3 P2 = evaluate_arc(u + du);\n        vec3 T = normalize((P1 - P0) + (P2 - P1));\n        vec3 Z = vec3(0, 0, 1);\n        vec4 Q = vec4(cross(Z, T), dot(Z, T));\n\n        //N = transform_quat(vec3(position.xy, 0.0), Q);\n        N = vec3(position.xy, 0.0);\n        float r = mix(radius, 0.0005, coord.x);\n        P = P1 + r * N;\n    }\n\n    v_normal = N;\n    v_position = P;\n    gl_Position = mvp * vec4(P, 1.0);\n}\n","arc2.fragment":"#define N_LIGHTS 3\nuniform vec3 light_position[N_LIGHTS];\nuniform vec3 light_direction[N_LIGHTS];\nuniform vec3 light_direction2[N_LIGHTS];\nuniform vec3 light_color[N_LIGHTS];\nuniform vec2 light_falloff[N_LIGHTS];\n\nuniform vec3 view_pos;\n\nvec3 toLinear(vec3 rgb) {\n    return pow(rgb, vec3(2.2));\n}\n\nvec3 filmic(vec3 c) {\n    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));\n    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);\n}\n\nvoid main() {\n    vec3 N = normalize(v_normal);\n    vec3 P = v_position;\n    vec3 V = normalize(view_pos - P);\n\n    vec3 C = vec3(0.001);\n    for (int i = 1; i < N_LIGHTS; ++i) {\n        vec3 L = normalize(light_position[i] - P);\n        float spot = dot(light_direction[i], -L);\n\n        float a = 0.0;\n        if (i > 0) {\n            a = dot(light_direction2[i], -L);\n        }\n\n        float fs = light_falloff[i].x;\n        float fw = light_falloff[i].y;\n\n        //fs = mix(0.9999, 0.500, a);\n        fs = 0.1;\n\n        /*\n        if (spot > fs) {\n            spot = clamp((spot - fs) / fw, 0.0, 1.0);\n        } else {\n            spot = 0.0;\n        }\n        */\n        if (spot < fs)\n            spot = 0.0;\n\n        //if (abs(a) > 0.01)\n            spot *= smoothstep(0.030, 0.00, abs(a));\n\n        vec3 H = normalize(L + V);\n        float NdotL = max(dot(N, L), 0.0);\n        float NdotH = max(dot(N, H), 0.0);\n\n        float diffuse = NdotL;\n        float specular = pow(NdotH, 90.0);\n        //C += (color.rgb * diffuse + specular) * light_color[i];\n        //C = 0.5 * (H + 1.0);\n        C += toLinear(light_color[i]) * spot * diffuse;\n        //C = (light_direction2[i]+1.0)/2.0;\n    }\n\n    gl_FragColor = vec4(filmic(C), 1.0);\n    //gl_FragColor = vec4(1, 0, 1, 1);\n}","background":"attribute vec2 coord;\nvarying vec3 v_color;\n","background.vertex":"uniform vec3 color0;\nuniform vec3 color1;\n\nvoid main() {\n    gl_Position = vec4(2.0*(coord - 0.5), 0.0, 1.0);\n    v_color = mix(color0, color1, coord.y);\n}\n","background.fragment":"void main() {\n    gl_FragColor = vec4(v_color, 1.0);\n}","cloud":"attribute vec4 position;\nattribute float color;\nattribute vec2 coord;\n\nvarying vec2 v_texcoord;\nvarying vec4 v_color;\nvarying float v_depth;\n","cloud.vertex":"uniform mat4 mvp;\nuniform mat3 bill;\nuniform float gradient_index;\nuniform sampler2D t_gradient;\nuniform float aspect;\n\nvoid main() {\n    vec3 P = vec3(coord, 0.0);\n    P.x *= aspect;\n    P = bill * P;\n    float scale = position.w;\n\n    P = position.xyz + scale * P;\n    gl_Position = mvp * vec4(P, 1.0);\n    gl_PointSize = scale;\n    v_texcoord = vec2(coord.x, 1.0-coord.y);\n\n    v_color = texture2D(t_gradient, vec2(color, gradient_index));\n    v_depth = gl_Position.z * gl_Position.w;\n}\n","cloud.fragment":"uniform sampler2D t_color;\nuniform bool zpass;\n\nvoid main() {\n    float fade = clamp(50.0 * v_depth, 0.0, 1.0);\n    fade = 1.0 - fade;\n    fade *= fade;\n    fade = 1.0 - fade;\n\n    float s = fade * texture2D(t_color, v_texcoord).r;\n    if (s < 1.0/256.0) discard;\n\n    gl_FragColor = vec4(s*v_color.rgb, s);\n}","cube":"attribute vec3 position;\nattribute vec3 normal;\n\nvarying vec3 v_normal;\nvarying vec3 v_position;\n","cube.vertex":"uniform mat4 mvp;\nuniform mat4 model_matrix;\nuniform mat3 normal_matrix;\nuniform float scale;\n\nvoid main() {\n    vec4 P = model_matrix * vec4(scale * position, 1.0);\n    v_normal = normal_matrix * normal;\n    v_position = P.xyz;\n    gl_Position = mvp * P;\n}\n","cube.fragment":"#extension GL_EXT_shader_texture_lod : enable\n\nuniform samplerCube t_iem;\nuniform samplerCube t_rem;\nuniform vec3 viewpos;\n\nvec3 filmic(vec3 c) {\n    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));\n    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);\n}\n\nvec3 toLinear(vec3 rgb) {\n    return pow(rgb, vec3(2.2));\n}\n\nvec3 decode_rgbm(vec4 rgbm) {\n    return 6.0 * rgbm.rgb * rgbm.a;\n}\n\nvoid main() {\n    vec3 V = normalize(viewpos - v_position);\n    vec3 N = normalize(v_normal);\n    vec3 R = -reflect(V, N);\n\n    vec3 Cd = vec3(0.50);\n    vec3 Ambient = decode_rgbm(textureCube(t_iem, -N));\n    vec3 C = Ambient * Cd;\n\n    if (true) {\n        float F0 = 0.03;\n        float NdotV = max(0.0, dot(N, V));\n        float F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);\n        float lod = 5.0;\n        vec3 Cs = toLinear(decode_rgbm(textureCube(t_rem, R)));\n        C += 0.8 * F * Cs;\n    }\n\n    gl_FragColor = vec4(filmic(C), 1.0);\n}","grid":"attribute vec2 position;\n","grid.vertex":"uniform mat4 mvp;\n\nvoid main() {\n    gl_Position = mvp * vec4(position.x, 0, position.y, 1);\n}\n","grid.fragment":"uniform vec4 color;\n\nvoid main() {\n    gl_FragColor = color;\n}\n\n","simple":"attribute vec3 position;\n","simple.vertex":"uniform mat4 mvp;\n\nvoid main() {\n    gl_Position = mvp * vec4(position, 1.0);\n    gl_PointSize = 3.0;\n}\n","simple.fragment":"uniform vec4 color;\n\nvoid main() {\n    gl_FragColor = color;\n}\n\n\n","blit":"attribute vec2 coord;\nvarying vec2 v_coord;\nuniform float alpha;\nuniform sampler2D s_rgba;\n","blit.vertex":"void main() {\n    v_coord = coord;\n    gl_Position = vec4(2.0*(coord - 0.5), 0.0, 1.0);\n}\n","blit.fragment":"void main() {\n    gl_FragColor = texture2D(s_rgba, v_coord);\n    gl_FragColor.a = alpha;\n}\n\n","pick_readback":"attribute vec2 coord;\nvarying vec2 v_coord;\nuniform sampler2D s_depth;\n","pick_readback.vertex":"void main() {\n    v_coord = coord;\n    gl_Position = vec4(2.0*(coord - 0.5), 0.0, 1.0);\n}\n","pick_readback.fragment":"void main() {\n    float d = texture2D(s_depth, v_coord).r;\n    gl_FragColor = vec4(d, 0.0, 0.0, 1.0);\n}","earth":"attribute vec3 position;\nattribute vec3 normal;\nattribute vec3 tangent;\nattribute vec2 texcoord;\n\nvarying vec3 v_normal;\nvarying vec3 v_tangent;\nvarying vec3 v_position;\nvarying vec2 v_texcoord;\n","earth.vertex":"uniform mat4 mvp;\nuniform mat4 model_matrix;\nuniform mat3 normal_matrix;\n\nvoid main() {\n    vec4 P = model_matrix * vec4(position, 1.0);\n    v_normal = normal_matrix * normal;\n    v_tangent = normal_matrix * tangent;\n    v_position = P.xyz;\n    v_texcoord = texcoord;\n    gl_Position = mvp * P;\n}\n","earth.fragment":"#extension GL_EXT_shader_texture_lod : enable\n\nuniform vec3 color;\nuniform vec3 view_position;\nuniform sampler2D t_normal;\nuniform float normal_scale;\nuniform vec3 light_position;\n\nfloat G1V(float NdotV, float k) { return 1.0 / (NdotV*(1.0 - k) + k); }\nvec3 toLinear(vec3 rgb) { return pow(rgb, vec3(2.2)); }\nvec3 toGamma(vec3 rgb) { return pow(rgb, vec3(1.0/2.2)); }\nvec3 filmic(vec3 c) {\n    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));\n    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);\n}\n\nvoid main() {\n    vec3 N = normalize(v_normal);\n    vec3 V = normalize(view_position - v_position);\n    vec3 L = normalize(light_position - v_position);\n    \n    if (true) {\n        vec3 T = normalize(v_tangent);\n        vec3 B = cross(N, T);\n        mat3 TBN = mat3(T, B, N);   // ts -> ws\n\n        vec3 s = texture2D(t_normal, normal_scale * v_texcoord).rgb;\n        float normal_mix = 1.0;\n        N = mix(N, normalize(TBN * 2.0*(s - 0.5)), normal_mix);\n    }\n\n    float NdotL = max(0.0, dot(N, L));\n    vec3 C = mix(0.15, 0.7, NdotL) * color;\n\n    //vec3 C = mix(0.7, 0.4, NdotV) * color;\n    gl_FragColor = vec4(filmic(C), 1.0);\n}","fxaa":"attribute vec2 coord;\nvarying vec2 v_coord;\n","fxaa.vertex":"void main() {\n    v_coord = coord;\n    gl_Position = vec4(2.0*(coord - 0.5), 0.0, 1.0);\n}\n","fxaa.fragment":"uniform bool enable;\nuniform vec2 resolution;\nuniform sampler2D s_color;\n\nvoid texcoords(\n    vec2 fragCoord, vec2 resolution,\n    out vec2 v_rgbNW, out vec2 v_rgbNE,\n    out vec2 v_rgbSW, out vec2 v_rgbSE,\n    out vec2 v_rgbM)\n{\n    vec2 inverseVP = 1.0 / resolution.xy;\n    v_rgbNW = (fragCoord + vec2(-1.0, -1.0)) * inverseVP;\n    v_rgbNE = (fragCoord + vec2(1.0, -1.0)) * inverseVP;\n    v_rgbSW = (fragCoord + vec2(-1.0, 1.0)) * inverseVP;\n    v_rgbSE = (fragCoord + vec2(1.0, 1.0)) * inverseVP;\n    v_rgbM = vec2(fragCoord * inverseVP);\n}\n\n#ifndef FXAA_REDUCE_MIN\n    #define FXAA_REDUCE_MIN   (1.0/ 128.0)\n#endif\n#ifndef FXAA_REDUCE_MUL\n    #define FXAA_REDUCE_MUL   (1.0 / 8.0)\n#endif\n#ifndef FXAA_SPAN_MAX\n    #define FXAA_SPAN_MAX     8.0\n#endif\n\n//optimized version for mobile, where dependent \n//texture reads can be a bottleneck\nvec4 fxaa(\n    sampler2D tex,\n    vec2 fragCoord,\n    vec2 resolution,\n    vec2 v_rgbNW, vec2 v_rgbNE, \n    vec2 v_rgbSW, vec2 v_rgbSE, \n    vec2 v_rgbM)\n{\n    vec4 color;\n    vec2 inverseVP = vec2(1.0 / resolution.x, 1.0 / resolution.y);\n    vec3 rgbNW = texture2D(tex, v_rgbNW).xyz;\n    vec3 rgbNE = texture2D(tex, v_rgbNE).xyz;\n    vec3 rgbSW = texture2D(tex, v_rgbSW).xyz;\n    vec3 rgbSE = texture2D(tex, v_rgbSE).xyz;\n    vec4 texColor = texture2D(tex, v_rgbM);\n    vec3 rgbM  = texColor.xyz;\n    vec3 luma = vec3(0.299, 0.587, 0.114);\n    float lumaNW = dot(rgbNW, luma);\n    float lumaNE = dot(rgbNE, luma);\n    float lumaSW = dot(rgbSW, luma);\n    float lumaSE = dot(rgbSE, luma);\n    float lumaM  = dot(rgbM,  luma);\n    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));\n    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));\n    \n    vec2 dir;\n    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));\n    dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));\n    \n    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) *\n                          (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);\n    \n    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);\n    dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX),\n              max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),\n              dir * rcpDirMin)) * inverseVP;\n    \n    vec3 rgbA = 0.5 * (\n        texture2D(tex, fragCoord * inverseVP + dir * (1.0 / 3.0 - 0.5)).xyz +\n        texture2D(tex, fragCoord * inverseVP + dir * (2.0 / 3.0 - 0.5)).xyz);\n    vec3 rgbB = rgbA * 0.5 + 0.25 * (\n        texture2D(tex, fragCoord * inverseVP + dir * -0.5).xyz +\n        texture2D(tex, fragCoord * inverseVP + dir * 0.5).xyz);\n\n    float lumaB = dot(rgbB, luma);\n    if ((lumaB < lumaMin) || (lumaB > lumaMax))\n        color = vec4(rgbA, texColor.a);\n    else\n        color = vec4(rgbB, texColor.a);\n    return color;\n}\n\nvec4 apply_fxaa(\n    sampler2D tex,\n    vec2 fragCoord,\n    vec2 resolution)\n{\n    vec2 v_rgbNW;\n    vec2 v_rgbNE;\n    vec2 v_rgbSW;\n    vec2 v_rgbSE;\n    vec2 v_rgbM;\n\n    //compute the texture coords\n    texcoords(fragCoord, resolution, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);\n    \n    //compute FXAA\n    return fxaa(tex, fragCoord, resolution, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);\n    //return vec4(0.0);\n}\n\n\nvoid main() {\n    if (enable) {\n        gl_FragColor.rgba = apply_fxaa(\n                s_color,\n                gl_FragCoord.xy,\n                resolution);\n    } else {\n        gl_FragColor.rgba = texture2D(s_color, v_coord).rgba;\n    }\n}","groove":"attribute vec2 coord;\nvarying vec3 v_normal;\nvarying vec3 v_tangent;\nvarying vec3 v_bitangent;\nvarying vec3 v_position;\nvarying vec2 v_coord;\nvarying float v_depth;\n","groove.vertex":"uniform mat4 mvp;\nuniform mat4 view;\nuniform float time;\nuniform sampler2D t_curve;\n\nvec3 get_pos(vec2 co) {\n    vec3 P;\n    P.x = 20.0 * (co.x - 0.5);\n    P.y = 0.5;\n    P.z = 0.0;\n\n    float center = 0.5;\n    float w = 0.1;\n    float width = mix(0.0, 0.1,\n        smoothstep(w + 0.1, w, abs(fract(time + co.y) - 0.5)));\n    float h = -smoothstep(0.08 + width, 0.02 + width, abs(co.x - center));\n    P.y = h;\n\n    //if (coord.x == 0.0) P.x -= 1000.0;\n    //if (coord.x == 1.0) P.x += 1000.0;\n\n    if (abs(P.x) > 4.0)\n        P.x *= 100.0;\n\n    {\n        vec3 T = texture2D(t_curve, vec2(co.y, 0.0)).xyz;\n        //vec4 Q = texture2D(t_curve, vec2(co.y, 1.0));\n        //P = transform_quat(P, Q);\n        //P += T;\n        //P.xy += T.xy;\n        //P.z += 100.0*T.z;\n        P += T;\n    }\n\n    return P;\n}\n\nvoid main() {\n    vec3 P = get_pos(coord);\n    vec3 Pdx = normalize(get_pos(coord + vec2(1.0/256.0, 0.0)) - P);\n    vec3 Pdy = normalize(get_pos(coord + vec2(0.0, 1.0/256.0)) - P);\n    vec3 N = normalize(cross(Pdx, Pdy));\n\n    //vec3 Pdx = vec3(-1, 0, 0);\n    //vec3 Pdy = normalize(get_pos(coord + vec2(0.0, 1.0/128.0)) - P);\n    v_tangent = vec3(1,0,0);\n    v_bitangent = cross(v_tangent, N);\n\n    v_normal = N;\n    v_position = P;\n\n    gl_Position = mvp * vec4(P, 1.0);\n\n    {\n        vec3 Pv = (view * vec4(P, 1.0)).xyz;\n        v_depth = -Pv.z;\n    }\n\n    v_coord = 4.0 * vec2(P.x/8.0, 8.0 * coord.y + time);\n}\n","groove.fragment":"#extension GL_OES_standard_derivatives : enable\n\nuniform vec3 color;\nuniform vec3 view_pos;\nuniform bool face_normal;\n\nuniform vec3 bg_color0;\nuniform vec3 bg_color1;\nuniform vec2 resolution;\n\nuniform sampler2D t_fabric;\n\nfloat grid(vec2 coord, float gsize, float gwidth) {\n    // http://www.gamedev.net/topic/529926-terrain-contour-lines-using-pixel-shader/\n    // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/\n    vec2 P = coord;\n    vec2 f = abs(fract(P * gsize)-0.5);\n    vec2 df = gsize * fwidth(P);\n    float mi = max(0.0, gwidth-1.0);\n    float ma = max(1.0, gwidth); //should be uniforms\n    vec2 g = clamp((f - df*mi) / (df * (ma-mi)), max(0.0, 1.0-gwidth), 1.0); // max(0.0,1.0-gwidth) should also be sent as uniform\n    float result = 2.0 * ((1.0 - g.x) + (1.0 - g.y));\n    return result;\n}\n\nvec3 toLinear(vec3 rgb) {\n    return pow(rgb, vec3(2.2));\n}\n\nvec3 filmic(vec3 c) {\n    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));\n    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);\n}\n\nvec3 fade_to_background(vec3 C) {\n    float depth = clamp(0.003 * v_depth, 0.0, 1.0);\n    vec3 bg_color = mix(bg_color0, bg_color1, gl_FragCoord.y/resolution.y);\n    return mix(C, bg_color, depth);\n}\n\nvoid main() {\n    vec3 N;\n    if (face_normal) {\n        vec3 Px = dFdx(v_position);\n        vec3 Py = dFdy(v_position);\n        N = normalize(cross(Px, Py));\n    } else {\n        N = normalize(v_normal);\n    }\n\n    if (true) {\n        vec3 T = normalize(v_tangent);\n        vec3 B = normalize(v_bitangent);\n        mat3 TBN = mat3(T, B, N);   // ts -> ws\n        vec3 normal = texture2D(t_fabric, v_coord).rgb;\n        vec3 mapNormal = 2.0*(normal - 0.5);\n        N = mix(N, normalize(TBN * mapNormal), 1.0);\n    }\n\n    vec3 V = normalize(view_pos - v_position);\n\n    vec3 light_pos = vec3(4, 10, 3);\n    vec3 L = normalize(light_pos - v_position);\n\n    float NdotL = max(0.0, dot(N, L));\n    //gl_FragColor = vec4((N + 1.0)/2.0, 1.0);\n\n    float diffuse = mix(0.2, 1.0, NdotL);\n    vec3 C = diffuse * toLinear(color);\n    gl_FragColor = vec4(filmic(C), 1.0);\n\n    //gl_FragColor.rgb = grid(v_coord, 80.0, 1.00) * C;\n    gl_FragColor.rgb = fade_to_background(gl_FragColor.rgb);\n\n    //gl_FragColor.rgb = texture2D(t_fabric, v_coord).rgb;\n\n    // normal debug\n    //gl_FragColor = vec4(0.5*(N + 1.0), 1.0);\n}\n\n\n\n","spd_background":"attribute vec2 coord;\nvarying vec3 v_color;\n","spd_background.vertex":"uniform vec3 color0;\nuniform vec3 color1;\n\nvoid main() {\n    gl_Position = vec4(2.0*(coord - 0.5), 0.0, 1.0);\n    v_color = mix(color0, color1, coord.y);\n}\n","spd_background.fragment":"void main() {\n    gl_FragColor = vec4(v_color, 1.0);\n\n}","meshflow":"attribute vec2 coord;\nvarying vec2 v_texcoord;\nvarying vec3 v_position;\nvarying vec3 v_normal;\nvarying vec3 v_tangent;\nvarying vec3 v_bitangent;\n","meshflow.vertex":"uniform mat4 mvp;\nuniform vec3 translate;\n\nvec3 get_pos(vec2 co) {\n    vec3 P = vec3(\n        4.0 * (co.x - 0.5),\n        0.0,\n        2.0 * (co.y - 0.5));\n\n    float y = 1.0 - co.y;\n    P.y = 3.0 * y * y;\n\n    float x = abs(co.x - 0.5);\n    P.y += 7.0 * x*x;\n    return P;\n}\n\nvoid main() {\n    vec3 P = get_pos(coord);\n    //vec3 Pdx = get_pos(coord + vec2(1.0/128.0, 0.0)) - P;\n    vec3 Pdx = vec3(-1, 0, 0);\n    vec3 Pdy = normalize(get_pos(coord + vec2(0.0, 1.0/128.0)) - P);\n\n    v_tangent = Pdx;\n    v_bitangent = Pdy;\n    vec3 N = normalize(cross(Pdx, Pdy));\n    v_normal = N;\n\n    P *= 10.0;\n    P += translate;\n\n    gl_Position = mvp * vec4(P, 1.0);\n    v_position = P;\n\n    {\n        vec2 co = coord;\n        //float y = coord.y;\n        //co.x = 2.0 * (co.x - 0.5) * mix(1.0, 1.0, y);\n        //co.x = 0.5 * (co.x + 1.0);\n        v_texcoord = co;\n    }\n}\n","meshflow.fragment":"uniform float time;\nuniform float drift;\nuniform sampler2D t_fabric;\nuniform vec3 color0;\nuniform vec3 color1;\nuniform vec3 light_pos;\nuniform vec3 view_pos;\n\nfloat hole(vec2 co, float size) {\n    const float PI = 3.141592653589793;\n    float s2 = 0.5 + (sin(2.0 * PI * 2.0 * co.y) * 0.5);\n\n    vec2 uv = co;\n    float ox = 0.0;\n    //uv.y -= 0.200;\n    if (fract(4.0*uv.y) > 0.5) {\n        //uv.x += 0.125;\n        size *= 1.5;\n        ox = 0.5;\n    }\n\n    uv *= vec2(8.0, 2.0);\n\n    uv.x += ox;\n    uv = fract(8.0 * uv);\n\n    uv = abs(uv - 0.5);\n    uv.x *= 1.0;\n    uv *= size;\n\n    uv *= mix(1.0, 2.0, s2);\n    return step(0.05, dot(uv, uv));\n}\n\nvec3 filmic(vec3 c) {\n    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));\n    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);\n}\n\nvec3 toLinear(vec3 rgb) {\n    return pow(rgb, vec3(2.2));\n}\n\nfloat fresnel(vec3 H, vec3 V, float f0) {\n    float base = 1.0 - dot(V, H);\n    float exponent = pow(base, 5.0);\n    return exponent + f0*(1.0 - exponent);\n}\n\nvec3 lighting(vec3 normal, vec3 color) {\n    vec3 V = normalize(view_pos - v_position);\n    vec3 N = normalize(v_normal);\n    vec3 R = -reflect(V, N);\n    vec3 L = normalize(light_pos - v_position);\n    vec3 H = normalize(L + V);\n\n    if (true) {\n        vec3 T = normalize(v_tangent);\n        vec3 B = normalize(v_bitangent);\n        mat3 TBN = mat3(T, B, N);   // ts -> ws\n        vec3 mapNormal = 2.0*(normal - 0.5);\n        N = mix(N, normalize(TBN * mapNormal), 1.0);\n    }\n\n    float NdotL = max(dot(N, L), 0.0);\n    float NdotH = max(dot(N, H), 0.0);\n\n    vec3 Cd = NdotL * toLinear(color);\n    vec3 Cs = vec3(0.0);\n\n    /*\n    {\n        float F0 = 0.03;\n        float NdotV = max(0.0, dot(N, V));\n        float F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);\n        Cs = F * vec3(0.5);\n    }\n    */\n\n    if (false) {\n        float specular = pow(NdotH, 20.0);\n        //specular *= 0.25;\n        specular *= mix(0.25, fresnel(H, V, 0.028), 0.5);\n        Cs = vec3(1.0) * specular;\n    }\n\n    return filmic(Cd + Cs);\n\n    //vec3 T = normalize(v_tangent);\n    //vec3 B = normalize(v_bitangent);\n    //gl_FragColor = vec4(0.5*(N+1.0), 1.0);\n    //gl_FragColor.rgb = filmic(Cd + Cs);\n}\n\nvoid main() {\n    vec2 co = v_texcoord;\n\n    float yy = v_texcoord.y;\n    yy *= yy * yy;\n\n    co.x = 2.0 * (co.x - 0.525);\n    co.x = co.x * mix(0.25, 2.0, 1.0 - yy);\n    co.x = 0.5 * (co.x + 1.0);\n    co.x += fract(drift);\n\n    co.y -= time;\n\n#if defined(STRIPES)\n    float x = fract(128.0 * co.x);\n    x = abs(x - 0.5);\n    x = 1.0 - smoothstep(0.1, 0.200, x);\n    vec3 color = vec3(0.02, 0.00, 0.10);\n    float alpha = x;\n    gl_FragColor = vec4(color, alpha);\n#elif defined(BACKGROUND)\n    vec4 C = texture2D(t_fabric, 16.0 * co);\n    vec3 color = mix(color1, color0, pow(1.8*C.a, 0.5));\n    //vec3 color = C.rgb;\n    float h = hole(co, 0.7);\n    color *= mix(1.0, 0.5, h);\n    float alpha = 1.0;\n    gl_FragColor = vec4(lighting(C.rgb, color), alpha);\n#elif defined(MESH)\n    vec4 C = texture2D(t_fabric, 8.0 * co);\n    vec3 color = mix(color1, color0, pow(1.8*C.a, 0.5));\n    float h = hole(co, 1.0);\n    float alpha = h;\n    gl_FragColor = vec4(lighting(C.rgb, color), alpha);\n#endif\n\n    //gl_FragColor = vec4(yy, 0.0, 0.0, 1.0);\n}","particles":"attribute vec4 position;\n","particles.vertex":"uniform mat4 mvp;\n\nvoid main() {\n    vec3 P = position.xyz;\n    gl_Position = mvp * vec4(P, 1.0);\n    gl_PointSize = position.w;\n}\n","particles.fragment":"void main() {\n    vec2 P = 2.0 * (gl_PointCoord.xy - 0.5);\n    float alpha = 1.0 - dot(P, P);\n    alpha *= 0.2;\n    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);\n}","landscape":"attribute vec2 coord;\n\nvarying vec3 v_normal;\nvarying vec3 v_view;\nvarying vec3 v_position;\nvarying vec2 v_coord;\n","landscape.vertex":"uniform mat4 mvp;\nuniform sampler2D t_scape;\nuniform float time;\n\nvec3 get_pos(vec2 co) {\n    vec3 P = 2.0 * (vec3(co.x, 0.5, co.y) - 0.5);\n    //P.z *= 2.0;\n    P = P * 10.0;\n    float h = texture2D(t_scape, vec2(co.x, co.y + time)).r;\n    P.y = 1.0 * h;\n    //P.y *= 0.0;\n    return P;\n}\n\nvoid main() {\n    vec3 P = get_pos(coord);\n    vec3 Pdx = normalize(get_pos(coord + vec2(1.0/256.0, 0.0)) - P);\n    vec3 Pdy = normalize(get_pos(coord + vec2(0.0, 1.0/256.0)) - P);\n    vec3 N = cross(Pdx, Pdy);\n\n    gl_Position = mvp * vec4(P, 1.0);\n    v_normal = -N;\n    v_position = P;\n    v_coord = vec2(coord.x, coord.y + time);\n}\n","landscape.fragment":"#extension GL_OES_standard_derivatives : enable\n\nuniform vec4 color;\nuniform vec3 view_pos;\nuniform mat2 stripe_mat0;\nuniform mat2 stripe_mat1;\n\n#define N_LIGHTS 3\nuniform vec3 light_position[N_LIGHTS];\nuniform vec3 light_direction[N_LIGHTS];\nuniform vec3 light_direction2[N_LIGHTS];\nuniform vec3 light_color[N_LIGHTS];\nuniform vec2 light_falloff[N_LIGHTS];\n\nfloat grid(vec2 coord, float gsize, float gwidth) {\n    vec2 P = coord;\n    vec2 f = abs(fract(P * gsize)-0.5);\n    vec2 df = gsize * fwidth(P);\n    float mi = max(0.0, gwidth-1.0);\n    float ma = max(1.0, gwidth); //should be uniforms\n    vec2 g = clamp((f - df*mi) / (df * (ma-mi)), max(0.0, 1.0-gwidth), 1.0); // max(0.0,1.0-gwidth) should also be sent as uniform\n    float result = 2.0 * ((1.0 - g.x) + (1.0 - g.y));\n    return result;\n}\n\nfloat stripe(vec2 coord, mat2 mat) {\n    vec2 co = mat * coord;\n    float y = abs(fract(co.y) - 0.5);\n    return smoothstep(0.050, 0.040, y);\n    //return 1.0 - step(0.050, y);\n}\n\nvec3 toLinear(vec3 rgb) {\n    return pow(rgb, vec3(2.2));\n}\n\nvec3 filmic(vec3 c) {\n    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));\n    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);\n}\n\nvoid main() {\n    // worldspace normal\n    vec3 N = normalize(v_normal);\n    vec3 P = v_position;\n    vec3 V = normalize(view_pos - P);\n\n    vec3 C = vec3(0.000);\n    for (int i = 0; i < N_LIGHTS; ++i) {\n        vec3 L = normalize(light_position[i] - P);\n        float spot = dot(light_direction[i], -L);\n\n        float a = 0.0;\n        if (i > 0) {\n            a = dot(light_direction2[i], -L);\n        }\n\n        float fs = light_falloff[i].x;\n        float fw = light_falloff[i].y;\n\n        //fs = mix(0.9999, 0.500, a);\n        fs = 0.1;\n\n        /*\n        if (spot > fs) {\n            spot = clamp((spot - fs) / fw, 0.0, 1.0);\n        } else {\n            spot = 0.0;\n        }\n        */\n        if (spot < fs)\n            spot = 0.0;\n\n        //if (abs(a) > 0.01)\n            spot *= smoothstep(0.015, 0.00, abs(a));\n\n        vec3 H = normalize(L + V);\n        float NdotL = max(dot(N, L), 0.0);\n        float NdotH = max(dot(N, H), 0.0);\n\n        float diffuse = NdotL;\n        float specular = pow(NdotH, 90.0);\n        //C += (color.rgb * diffuse + specular) * light_color[i];\n        //C = 0.5 * (H + 1.0);\n        C += toLinear(light_color[i]) * spot * diffuse;\n        //C = (light_direction2[i]+1.0)/2.0;\n    }\n\n    {\n        float s = min(1.0, stripe(v_coord, stripe_mat0) + stripe(v_coord, stripe_mat1));\n        float albedo = mix(0.050, 0.125, s);\n        C *= albedo;\n    }\n\n\n    gl_FragColor = vec4(filmic(C), 1.0);\n    //gl_FragColor = vec4(C, 1.0);\n\n    //gl_FragColor.rgb = vec3(0.0, grid(v_coord, 80.0, 1.0), 0.0);\n    //gl_FragColor.r = stripe(v_coord, stripe_mat0);\n    //gl_FragColor.b = stripe(v_coord, stripe_mat1);\n}","shoe_pick2":"attribute vec3 position;\nattribute vec2 texcoord;\nvarying vec2 v_texcoord;\n","shoe_pick2.vertex":"uniform mat4 mvp;\nuniform mat4 model_matrix;\n\nvoid main() {\n    vec4 P = model_matrix * vec4(position, 1.0);\n    gl_Position = mvp * P;\n    v_texcoord = vec2(texcoord.x, 1.0 - texcoord.y);\n}\n","shoe_pick2.fragment":"uniform sampler2D t_id;\nuniform vec3 color;\n\nvoid main() {\n    float id = texture2D(t_id, v_texcoord).a;\n    gl_FragColor = vec4(id * color, 1.0);\n}","shoe2":"attribute vec3 position;\nattribute vec3 normal;\nattribute vec3 tangent;\nattribute vec2 texcoord;\n\nvarying vec3 v_normal;\nvarying vec3 v_tangent;\nvarying vec3 v_position;\nvarying vec2 v_texcoord;\n","shoe2.vertex":"uniform mat4 mvp;\nuniform mat4 model_matrix;\nuniform mat3 normal_matrix;\n\nvoid main() {\n    vec4 P = model_matrix * vec4(position, 1.0);\n    v_normal = normal_matrix * normal;\n    v_tangent = normal_matrix * tangent;\n    v_position = P.xyz;\n    v_texcoord = vec2(texcoord.x, 1.0 - texcoord.y);\n    gl_Position = mvp * P;\n}\n","shoe2.fragment":"#extension GL_EXT_shader_texture_lod : enable\n#extension GL_OES_standard_derivatives : enable\n\nuniform vec3 color;\nuniform samplerCube t_iem;\nuniform samplerCube t_rem;\nuniform sampler2D t_color;\nuniform sampler2D t_normal;\nuniform sampler2D t_noise;\n\nuniform float lod;\nuniform vec3 viewpos;\nuniform float f0;\nuniform float normal_mix;\nuniform float normal_scale;\nuniform float specular;\nuniform float ambient;\nuniform float occlusion;\nuniform bool use_normal2;\nuniform vec3 id_blend;\n\nuniform float time;\nuniform vec2 resolution;\n\n\nfloat G1V(float NdotV, float k) {\n    return 1.0 / (NdotV*(1.0 - k) + k);\n}\n\nvec3 toLinear(vec3 rgb) {\n    return pow(rgb, vec3(2.2));\n}\n\nvec4 toLinear(vec4 rgba) {\n    return pow(rgba, vec4(2.2));\n}\n\nvec3 toGamma(vec3 rgb) {\n    return pow(rgb, vec3(1.0/2.2));\n}\n\n\nvec3 filmic(vec3 c) {\n    vec3 x = vec3(max(0.0, c.x-0.004), max(0.0, c.y-0.004), max(0.0, c.z-0.004));\n    return (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);\n}\n\nfloat edgeFactor(vec2 co){\n    vec2 d = fwidth(co);\n    vec2 a3 = smoothstep(vec2(0.0), d*1.5, co);\n    return min(a3.x, a3.y);\n}\n\nfloat grid(vec2 coord, float gsize, float gwidth) {\n    vec2 P = coord;\n    vec2 f = abs(fract(P * gsize)-0.5);\n    vec2 df = gsize * fwidth(P);\n    float mi = max(0.0, gwidth-1.0);\n    float ma = max(1.0, gwidth);\n    vec2 g = clamp((f - df*mi) / (df * (ma-mi)), max(0.0, 1.0-gwidth), 1.0);\n    float result = 2.0 * ((1.0 - g.x) + (1.0 - g.y));\n    return result;\n}\n\nfloat saturate(float x) { return clamp(x, 0.0, 1.0); }\nvec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }\n\nfloat specular_occlusion2(float NdotV, float occ) {\n    return saturate(pow(NdotV + occ, 4.0) - 1.0 + occ);\n}\n\nvec3 decode_rgbm(vec4 rgbm) {\n    return 6.0 * rgbm.rgb * rgbm.a;\n}\n\nvoid main() {\n    float alpha = 1.0;\n    float id = 0.0;\n\n    // worldspace\n    vec3 N = normalize(v_normal);\n\n#ifdef NORMAL_MAP\n    {\n        vec3 T = normalize(v_tangent);\n        vec3 B = cross(N, T);\n        mat3 TBN = mat3(T, B, N);   // ts -> ws\n\n        vec4 s = texture2D(t_normal, normal_scale * v_texcoord).rgba;\n        vec3 mapNormal;\n        if (use_normal2) {\n            vec3 N;\n            N.xy = 2.0*(s.rg - 0.5);\n            N.z = sqrt(1.0 - N.x*N.x + N.y*N.y);\n            mapNormal = N;\n        } else {\n            mapNormal = 2.0*(s.rgb - 0.5);\n        }\n\n        N = mix(N, normalize(TBN * mapNormal), normal_mix);\n        id = s.a;\n    }\n#endif\n\n    vec3 V = normalize(viewpos - v_position);\n    vec3 R = -reflect(V, N);\n\n    // output color\n    vec3 C = vec3(0.0);\n\n    // diffuse part\n    float occ;\n    vec3 Cd;\n\n    {\n        vec4 Cd_tex = toLinear(texture2D(t_color, v_texcoord));\n        vec2 grid_co = v_texcoord;\n\n        vec3 Cd_grid = mix(vec3(0.3), vec3(0.50), grid(grid_co, 80.0, 0.80));\n\n        float grid_blend = 0.0;\n\n        float id_edge = 0.50;\n\n        {\n            // id1\n            float x = abs(id - 0.5);\n            x = smoothstep(id_edge, 0.0, x);\n            grid_blend += id_blend[1] * x;\n        }\n\n        {\n            // id2\n            float x = abs(id - 1.0);\n            x = smoothstep(id_edge, 0.0, x);\n            grid_blend += id_blend[2] * x;\n        }\n\n        // id3\n        grid_blend += id_blend[0];\n\n        if (true) {\n            float z = 1.0 / 2.5;\n            vec2 co1 = z * 4.0 * vec2(v_texcoord.x, v_texcoord.y + time);\n            vec2 co2 = z * 8.0 * vec2(v_texcoord.x + time, v_texcoord.y);\n            float noise = mix(texture2D(t_noise, co1).r, texture2D(t_noise, co2).g, 0.5);\n            //float noise = texture2D(t_noise, co1).g;\n\n            grid_blend = (grid_blend + noise) * 0.5;\n            grid_blend = step(0.50, grid_blend);\n        }\n\n        Cd = mix(Cd_tex.rgb, Cd_grid, grid_blend);\n        occ = mix(1.0, Cd_tex.a, occlusion);\n    }\n\n    vec3 Ambient = decode_rgbm(textureCube(t_iem, -N)) * ambient;\n    Cd = occ * Ambient * Cd;\n\n    vec3 Cs = vec3(0.0);\n    if (true) {\n        float F0 = f0;\n        float NdotV = max(0.0, dot(N, V));\n        float F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);\n\n        Cs = toLinear(decode_rgbm(textureCube(t_rem, R)));\n\n        //float spec_occ = specular_occlusion(N, V, occ);\n        float spec_occ = specular_occlusion2(NdotV, occ);\n        float x = saturate(F) * spec_occ * specular;\n        Cs = x * Cs;\n    }\n\n    C = Cd + Cs;\n\n    gl_FragColor = vec4(filmic(C), 1.0);\n}","textest":"attribute vec3 position;\nattribute vec3 normal;\nattribute vec2 texcoord;\n\nvarying vec3 v_normal;\nvarying vec2 v_texcoord;\n\nuniform mat4 mvp;\nuniform vec4 color;\n\nuniform samplerCube t_color;\n//uniform sampler2D t_color;\n","textest.vertex":"void main() {\n    gl_Position = mvp * vec4(position, 1.0);\n    v_normal = normal;\n    v_texcoord = texcoord;\n}\n","textest.fragment":"#extension GL_EXT_shader_texture_lod : enable\n\nvoid main() {\n    vec3 N = normalize(v_normal);\n    //vec3 C = textureCube(t_color, N).rgb;\n    vec3 C = textureCubeLodEXT(t_color, N, 5.0).rgb;\n\n    //vec3 C = texture2D(t_color, v_texcoord).rgb;\n    gl_FragColor = vec4(C, 1.0);\n\n    //gl_FragColor = vec4((N*0.5)+0.5, 1.0);\n    //gl_FragColor = vec4(C, 1.0);\n}","tunnel":"attribute vec2 coord;\nvarying vec2 v_coord;\nuniform mat4 mvp;\nuniform vec4 color;\nuniform sampler2D t_frames;\nuniform float time;\nuniform float radius;\n\nuniform vec2 warp;\n","tunnel.vertex":"vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }\nvec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }\nvec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }\nvec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }\nvec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }\nvec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }\nvec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }\n\n// Classic Perlin noise, periodic variant\nfloat pnoise(vec2 P, vec2 rep) {\n  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);\n  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);\n  Pi = mod(Pi, rep.xyxy); // To create noise with explicit period\n  Pi = mod289(Pi);        // To avoid truncation effects in permutation\n  vec4 ix = Pi.xzxz;\n  vec4 iy = Pi.yyww;\n  vec4 fx = Pf.xzxz;\n  vec4 fy = Pf.yyww;\n\n  vec4 i = permute(permute(ix) + iy);\n\n  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;\n  vec4 gy = abs(gx) - 0.5 ;\n  vec4 tx = floor(gx + 0.5);\n  gx = gx - tx;\n\n  vec2 g00 = vec2(gx.x,gy.x);\n  vec2 g10 = vec2(gx.y,gy.y);\n  vec2 g01 = vec2(gx.z,gy.z);\n  vec2 g11 = vec2(gx.w,gy.w);\n\n  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));\n  g00 *= norm.x;  \n  g01 *= norm.y;  \n  g10 *= norm.z;  \n  g11 *= norm.w;  \n\n  float n00 = dot(g00, vec2(fx.x, fy.x));\n  float n10 = dot(g10, vec2(fx.y, fy.y));\n  float n01 = dot(g01, vec2(fx.z, fy.z));\n  float n11 = dot(g11, vec2(fx.w, fy.w));\n\n  vec2 fade_xy = fade(Pf.xy);\n  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);\n  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);\n  return 2.3 * n_xy;\n}\n\nfloat snoise(vec2 v) {\n    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);\n    vec2 i  = floor(v + dot(v, C.yy) );\n    vec2 x0 = v -   i + dot(i, C.xx);\n    vec2 i1;\n    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n    vec4 x12 = x0.xyxy + C.xxzz;\n    x12.xy -= i1;\n    i = mod289(i);\n    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));\n    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);\n    m = m*m;\n    m = m*m;\n    vec3 x = 2.0 * fract(p * C.www) - 1.0;\n    vec3 h = abs(x) - 0.5;\n    vec3 ox = floor(x + 0.5);\n    vec3 a0 = x - ox;\n    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );\n    vec3 g;\n    g.x  = a0.x  * x0.x  + h.x  * x0.y;\n    g.yz = a0.yz * x12.xz + h.yz * x12.yw;\n    return 130.0 * dot(m, g);\n}\n\nvec3 transform_quat(vec3 v, vec4 q) {\n    vec3 t = 2.0 * cross(q.xyz, v);\n    return v + q.w*t + cross(q.xyz, t);\n}\n\nvoid main() {\n    const float PI = 3.14159265359;\n    const float TWO_PI = 2.0 * PI;\n\n    vec3 P;\n    float theta = TWO_PI * coord.x;\n    float r = radius * mix(1.0, 0.0, coord.y);\n\n    //r += 1.5 * pnoise(vec2(time + coord.x*16.0, coord.y*680), vec2(16.0, 16.0));\n    r += 0.2 * pnoise(vec2(coord.x*16.0, (coord.y + time) * 16.0), vec2(16.0, 16.0));\n\n    P.x = r * cos(theta);\n    P.y = r * sin(theta);\n    P.z = 0.0;\n\n    {\n        vec3 T = texture2D(t_frames, vec2(coord.y, 0.0)).xyz;\n        vec4 Q = texture2D(t_frames, vec2(coord.y, 1.0));\n        P = transform_quat(P, Q);\n        P += T;\n    }\n\n    gl_Position = mvp * vec4(P, 1.0);\n    v_coord = vec2(coord.x, coord.y + time);\n}\n","tunnel.fragment":"void main() {\n#ifdef INNER\n    float u = v_coord.x;\n    float theta = warp.y * v_coord.y;\n    u += warp.x * sin(theta);\n\n    float z = 2.0 * abs(fract(64.0*u) - 0.5);\n    z = smoothstep(0.5, 1.0, z);\n    if (z == 0.0)\n        discard;\n\n    vec3 C0 = vec3(0, 0, 1);\n    vec3 C1 = vec3(0, 1, 0.5);\n    float w = 2.0 * abs(fract(v_coord.y) - 0.5);\n\n    vec3 C = z * mix(C0, C1, w);\n    //vec3 C = vec3(0, 0, 1.0 * z);\n    gl_FragColor = vec4(C, z);\n#else\n    vec3 C0 = vec3(1, 1, 0);\n    vec3 C1 = vec3(1, 0, 1);\n\n    float z = 2.0 * abs(fract(v_coord.y) - 0.5);\n    vec3 C = mix(C0, C1, z);\n\n    {\n        // dots\n        vec2 c = fract(v_coord * vec2(64.0, 20.0));\n        float s = length(0.5 - c);\n        if (s < 0.10)\n            C = vec3(0, 0, 1);\n    }\n\n    gl_FragColor = vec4(C, 1.0);\n#endif\n}","widget":"attribute vec3 position;\nattribute vec2 texcoord;\nvarying vec2 v_texcoord;\nvarying float v_depth;\n","widget.vertex":"uniform mat4 mvp;\nuniform mat4 view;\nuniform vec3 translate;\nuniform vec4 rotate;\nuniform float scale;\n\nvec3 transform_quat(vec3 v, vec4 q) {\n    vec3 t = 2.0 * cross(q.xyz, v);\n    return v + q.w*t + cross(q.xyz, t);\n}\n\nvoid main() {\n    vec3 P = position;\n    P = transform_quat(P, rotate);\n    P *= scale;\n    P.xyz += translate;\n\n    gl_Position = mvp * vec4(P, 1.0);\n    v_texcoord = vec2(texcoord.x, 1.0-texcoord.y);\n\n    {\n        vec3 Pv = (view * vec4(P, 1.0)).xyz;\n        v_depth = -Pv.z;\n    }\n}\n","widget.fragment":"uniform sampler2D t_color;\nuniform vec3 color;\n\nuniform vec3 bg_color0;\nuniform vec3 bg_color1;\nuniform vec2 resolution;\n\nvec3 fade_to_background(vec3 C) {\n    float depth = clamp(0.003 * v_depth, 0.0, 1.0);\n    vec3 bg_color = mix(bg_color0, bg_color1, gl_FragCoord.y/resolution.y);\n    return mix(C, bg_color, depth);\n}\n\nvoid main() {\n    vec3 C = texture2D(t_color, v_texcoord).rgb;\n    gl_FragColor = vec4(color * C, 1.0);\n    gl_FragColor.rgb = fade_to_background(gl_FragColor.rgb);\n}"};
