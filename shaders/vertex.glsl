#version 300 es

in vec2 a_position;
in vec2 a_uv;
out vec2 vUv;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    vUv = a_uv;
}
