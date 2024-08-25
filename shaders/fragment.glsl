#version 300 es
precision highp float;

in vec2 vUv; // uv gets passsed along from the original buffer to the fragment shader
out vec4 outColor;

uniform mediump sampler2DArray uTextureArray; // this is the float 32 texture array we're passing in

// Below units are in samples count, can be in other units (like pixels) as well
uniform int uWindow; // this is the sample window size we're rendering
uniform int lod; // synthetic lod
uniform int uTextureWidth; // width of texture in texels
uniform int uOffset; // this is the offset in samples from the absolute start

uniform int uHeight; // this is the height of the canvas in px
uniform int uWidth; // this is the width of the canvas in px

uniform int cueSample;
uniform int activeSample; // playback position

// Define line thickness
float lineThickness = 1.0;

vec4 texelFetch1D(mediump sampler2DArray textureArray, int textureWidth, int i, int l)
{
    ivec3 coord = ivec3(i % textureWidth, i / textureWidth, l);
    return texelFetch(textureArray, coord, 0);
}

float inclusiveStep(float edge, float x) {
    return 1.0 - step(x, edge);
}

float interStep(float min, float max, float value)
{
    return inclusiveStep(min, value) * inclusiveStep(value, max);
}

float toPixelSpace(float s) {
    int lodWindow = uWindow / int(pow(2.0, float(lod)));
    int lodOffset = uOffset / int(pow(2.0, float(lod)));

    return (s - float(lodOffset)) * float(uWidth) / (2.0 * float(lodWindow));
}

float toSampleSpace(float px) {
    int lodWindow = uWindow / int(pow(2.0, float(lod)));
    int lodOffset = uOffset / int(pow(2.0, float(lod)));

    return ((2.0 * px - 1.0) * float(lodWindow) / float(uWidth)) + float(lodOffset); // 0.5 is debatable
}

void main() {
    float v = 0.0;

    // compensate for lod (every lod scales down by a power of 2), these are the _actual_ values
    int lodWindow = uWindow / int(pow(2.0, float(lod)));
    int lodOffset = uOffset / int(pow(2.0, float(lod)));
    int lodActiveSample = activeSample / int(pow(2.0, float(lod)));
    int lodCueSample = cueSample / int(pow(2.0, float(lod)));

    // // helpers for pixel position
    // float pxlfloor = gl_FragCoord.y - 0.5; // start of a pixel
    // float pxlmiddle = gl_FragCoord.y;
    // float pxlroof = gl_FragCoord.y + 0.5; // end of a pixel

    vec2 p = gl_FragCoord.xy;
    float x = vUv.x * float(uWidth); // x pos in canvas pixel space // TODO; check .5
    float s = toSampleSpace(x); // x pos in total real (lod adjusted) sample space
    float sppx = 2.0 * float(lodWindow) / float(uWidth); // samples per px (should be between 1 and 2) * 2.0

    // we're looking for the outer most samples that affect the pixel (factor 2.0 seems to improve things)
    float posl = s - 1.0 * sppx; // this will include the start of the last left relevant pixel (at exact pos)
    float posr = s + 1.0 * sppx; // this will include the start if the first irrelevant pixel (at exact pos)
    float posl2 = s - 2.0 * sppx; // using these takes away some of the jitteryness in the aa calculation
    float posr2 = s + 2.0 * sppx;

    // // used for debugging
    // float imin = 0.0;
    // float imax = 0.0;

    for (float i = posl2; i < posr2; i += 1.0) {
        int sampleIndex = int(i); // floors i to get the sample index

        vec4 val = texelFetch1D(uTextureArray, uTextureWidth, sampleIndex, lod);

        // calculate the pixel position of the sample
        float ax = toPixelSpace(float(i));
        float bx = toPixelSpace(float(i) + 1.0);
        float ay = 0.5 * (1.0 + val.r) * float(uHeight);
        float by = 0.5 * (1.0 + val.g) * float(uHeight);
        vec2 a = vec2(ax, ay);
        vec2 b = vec2(bx, by);

        // setup vectors
        vec2 ba = b - a; // vector from a to b
        vec2 pa = p - a; // vector from a to p

        // little bit of linear algebra, we're projecting the point p onto the line ab
        // this is a really good way to get the closest point on a line to a given point (in 2 dimensions)
        float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        vec2 closestPoint = a + t * ba;

        // Compute the distance from the fragment to the closest point on the line
        float dist = length(p - closestPoint);
        float distFactor = clamp(dist, 0.1, 1.0); // play with these values to increase/decrease the softness of the line

        // Compute the alpha using the distance factor
        float alpha = smoothstep(lineThickness - distFactor, lineThickness + distFactor, dist);

        // invert alpha
        v += mix(1.0, 0.0, alpha);

        // // debugging info
        // imin += interStep(pxlfloor/float(uHeight), pxlroof/float(uHeight), v1);
        // imax += interStep(pxlfloor/float(uHeight), pxlroof/float(uHeight), v2);
    }

    // Apply gamma correction
    v = pow(clamp(v, 0.0, 1.0), 1.0 / 2.2);

    outColor = vec4(vec3(v), 1.0);

    outColor = (int(posl) <= lodCueSample && int(posr) >= lodCueSample) ? vec4(0.0, 1.0, 1.0, 1.) : outColor;
    outColor = (int(posl) <= lodActiveSample && int(posr) >= lodActiveSample) ? vec4(1.0, 0.0, 0.0, 1.) : outColor;
}
