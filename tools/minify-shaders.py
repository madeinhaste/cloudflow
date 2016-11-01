import os
import subprocess

src_dir = 'static/shaders'
dst_dir = 'static/shaders/min'

glslmin = 'node_modules/.bin/glslmin'

for filename in os.listdir(src_dir):
    if filename.endswith('.glsl'):
        args = [
            glslmin,
            '-o', os.path.join(dst_dir, filename),
            os.path.join(src_dir, filename)
            ]
        subprocess.call(args)
