/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("webgl-canvas");
/** @type {WebGL2RenderingContext} */
const gl = canvas.getContext("webgl2", { antialias: false });

const width = canvas.clientWidth;
const height = canvas.clientHeight;
const devicePixelRatio = window.devicePixelRatio || 1;

canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
canvas.style.width = width + 'px';
canvas.style.height = height + 'px';


let viewportWidth = canvas.width;
let viewportHeight = canvas.height;
function setViewport () {
    viewportWidth = canvas.width;
    viewportHeight = canvas.height;
    gl.viewport(0, 0, viewportWidth, viewportHeight);
}
setViewport()

// Vertex Shader Source
const vertexShaderSource = await fetch("vertex.glsl").then((res) => res.text())
// Fragment Shader Source
const fragmentShaderSource = await fetch("fragment.glsl").then((res) => res.text())



// Compile Shader Function
function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(
            "Shader compile error:",
            gl.getShaderInfoLog(shader),
        );
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Create and Compile Shaders
const vertexShader = compileShader(
    gl.VERTEX_SHADER,
    vertexShaderSource,
);
const fragmentShader = compileShader(
    gl.FRAGMENT_SHADER,
    fragmentShaderSource,
);

// Create and Link Program
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
        "Program link error:",
        gl.getProgramInfoLog(program),
    );
    gl.deleteProgram(program);
}
gl.useProgram(program);

// Define Quad Vertices
const vertices = new Float32Array([
    -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1,
]);

// Create and Bind Vertex Array
const vertexArray = gl.createVertexArray();
gl.bindVertexArray(vertexArray);

// Create and Bind Buffer
const vertexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// Get Attribute Locations
const positionLocation = gl.getAttribLocation(
    program,
    "a_position",
);
const uvLocation = gl.getAttribLocation(program, "a_uv");

// Setup Position Attribute
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(
    positionLocation,
    2,
    gl.FLOAT,
    false,
    4 * 4,
    0,
);

// Setup UV Attribute
gl.enableVertexAttribArray(uvLocation);
gl.vertexAttribPointer(
    uvLocation,
    2,
    gl.FLOAT,
    false,
    4 * 4,
    2 * 4,
);

const audioCtx = new window.AudioContext();
// load audio file ./audio.mp3
const resp = await fetch("https://archive.org/download/daft-punk-homework/A2.%20WDPK%2083.7%20FM.mp3");
const arrayBuffer = await resp.arrayBuffer();
const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
const channelData = audioBuffer.getChannelData(0);

let activeSource = null;
let startTime = 0;
let startPosition = 0;
function playAudio(sample) {
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    startPosition = sample;
    const t = startPosition / source.buffer.sampleRate

    source.connect(audioCtx.destination);
    source.start(0, t); // Start immediately
    // get current time, not of the context
    startTime = performance.now();
    activeSource = source;
}
function stopAudio() {
    if (activeSource) {
        activeSource.stop();
        // activeSource.context.
        activeSource = null;
    }
}
function getActiveSample() {
    if (activeSource) {
        return startPosition + Math.floor((performance.now() - startTime) * activeSource.buffer.sampleRate / 1000);
    }
    return startPosition;
}

let cuePosition = 0;


// listen globally to keydown handlers
window.addEventListener("keydown", (e) => {
    if (e.repeat) return

    if (e.key === "q") {
        playAudio(cuePosition);
    }
});
window.addEventListener("keyup", (e) => {
    if (e.key === "q") {
        stopAudio();
    }
});


function nextPowerOf2(x) {
    if (x < 1) return 1;
    return Math.pow(2, Math.ceil(Math.log2(x)));
}

function getTextureDimensions (size) {
    const baseSize = nextPowerOf2(Math.sqrt(size));
    const textureWidth = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), baseSize);
    const textureHeight = Math.ceil(size / textureWidth);

    return [ textureWidth, nextPowerOf2(textureHeight) ];
}

/**
 * @param {Float32Array} data
 * @param {number} lvl
 * @param {object} options
 */
function generateMipmap (data, lvl = 0, { size } = {}) {
    const f = 2 ** lvl;

    const dataAmount = data.length;

    const [ width, height ] = getTextureDimensions(dataAmount);

    const dataTarget = (data.length / f);

    console.time(`generateMipmap ${lvl}`);
    const samples = new Float32Array(size);
    for (let i = 0; i <= dataTarget; i += 1) {
        const stepSize = f;

        const r = 2*i
        const g = 2*i + 1

        if (lvl === 0) {
            samples[r] = data[i] / 1.4
            samples[g] = data[i+1] / 1.4
            continue
        }

        // todo is -1 on first index
        const bucketStart = i * stepSize -1 // todo check if -1 better indeed (include last of previous)
        const bucketEnd = i * stepSize + 2 * stepSize + 1

        if (data[bucketStart] === undefined && bucketStart > 0) {
            break;
        }

        let min = data[bucketStart] ?? 0
        let max = data[bucketStart] ?? 0
        for (let j = bucketStart; j <= bucketEnd; j += 1) {
            const v = data[j];

            min = v < min ? v : min;
            max = v > max ? v : max;
        }

        samples[r] = data[bucketStart] <= data[bucketEnd] ? min / 1.4 : max / 1.4;
        samples[g] = data[bucketStart] <= data[bucketEnd] ? max / 1.4 : min / 1.4;
    }
    console.timeEnd(`generateMipmap ${lvl}`);

    return [
        gl.TEXTURE_2D_ARRAY,
        0,
        0, 0, lvl,          // x, y offsets and the layer index (z offset)
        width,
        height,
        1,
        gl.RG,
        gl.FLOAT,
        samples
    ]
}

const [ textureWidth, textureHeight ] = getTextureDimensions(channelData.length); // to set  as uniform

const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);

const layers = 12;   // Number of 2D textures in the array
const size = textureHeight*textureWidth*layers*2 // 2 channels per texture (RG)

console.log(`Texture size: ${size*4/(1024**3)} GB`)

// setup texture
gl.texImage3D(
    gl.TEXTURE_2D_ARRAY,
    0,                 // Level of detail (0 is the base level)
    gl.RG32F,           // Internal format
    textureWidth,             // Width of each layer
    textureHeight,            // Height of each layer
    layers,            // Number of layers
    0,                 // Border (must be 0)
    gl.RG,           // Format of the texel data
    gl.FLOAT,  // Data type of the texel data
    new Float32Array(size)               // Data (null here because we're just allocating space)
);

// generate synthetic mipmaps for all layers
for (let lod = 0; lod <= layers; lod++) {
    gl.texSubImage3D(...generateMipmap(channelData, lod, { size }));
}

gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);


// Set Uniforms
const textureLocation = gl.getUniformLocation(program, "uTextureArray");
gl.uniform1i(textureLocation, 0);

// Get uniform locations for window and samples
const windowLocation = gl.getUniformLocation(program, "uWindow");
const lodLocation = gl.getUniformLocation(program, "lod");
const textureWidthLocation = gl.getUniformLocation(program, "uTextureWidth");
const offsetLocation = gl.getUniformLocation(program, "uOffset");

const playbackPositionLocation = gl.getUniformLocation(program, "activeSample");
const cueSampleLocation = gl.getUniformLocation(program, "cueSample");

const widthLocation = gl.getUniformLocation(program, "uWidth");
const heightLocation = gl.getUniformLocation(program, "uHeight");

let sampleWindow = viewportWidth; // start with 1 sample per pixel
let lod = 0;
let offset = 0;
gl.uniform1i(windowLocation, sampleWindow);
gl.uniform1i(lodLocation, lod);
gl.uniform1i(textureWidthLocation, textureWidth);
gl.uniform1i(offsetLocation, offset);

gl.uniform1i(playbackPositionLocation, cuePosition);
gl.uniform1i(cueSampleLocation, cuePosition);

gl.uniform1i(widthLocation, viewportWidth);
gl.uniform1i(heightLocation, viewportHeight);

// Bind Texture Unit
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);


function animate() {
    gl.uniform1i(offsetLocation, offset);
    gl.uniform1i(windowLocation, sampleWindow);
    gl.uniform1i(lodLocation, lod)

    gl.uniform1i(widthLocation, canvas.width);
    gl.uniform1i(heightLocation, canvas.height);

    gl.uniform1i(playbackPositionLocation, getActiveSample());

    // Set Viewport and Draw
    setViewport();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(animate);
}

const settingsForm = document.getElementById("settings");

settingsForm.elements["window"].value = sampleWindow;

settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sampleWindow = parseInt(e.target.window.value);
});

const lodMeter = document.getElementById("lod");
canvas.addEventListener("wheel", (e) => {
    e.preventDefault();

    const minSize = viewportWidth
    const step = e.deltaY * Math.floor(sampleWindow / 100)
    sampleWindow = Math.max(sampleWindow + step, minSize);
    settingsForm.elements["window"].value = sampleWindow;

    offset += e.deltaX * sampleWindow / viewportWidth;
    if (step) {
        const rect = e.target.getBoundingClientRect();
        const x = (event.clientX - rect.left) / devicePixelRatio;
        offset -= 8 * step * (x / viewportWidth); // no idea where that 4 comes from it just works (4*2)
    }

    // hacky way to set LOD
    if (sampleWindow < (2048 * 2.0** 1)) lodMeter.value = lod = 0;
    else if (sampleWindow < 2048 * 2.0** 2) lodMeter.value = lod = 1;
    else if (sampleWindow < 2048 * 2.0** 3) lodMeter.value = lod = 2;
    else if (sampleWindow < 2048 * 2.0** 4) lodMeter.value = lod = 3;
    else if (sampleWindow < 2048 * 2.0** 5) lodMeter.value = lod = 4;
    else if (sampleWindow < 2048 * 2.0** 6) lodMeter.value = lod = 5;
    else if (sampleWindow < 2048 * 2.0** 7) lodMeter.value = lod = 6;
    else if (sampleWindow < 2048 * 2.0** 8) lodMeter.value = lod = 7;
    else if (sampleWindow < 2048 * 2.0** 9) lodMeter.value = lod = 8;
    else if (sampleWindow < 2048 * 2.0** 10) lodMeter.value = lod = 9;
    else if (sampleWindow < 2048 * 2.0** 11) lodMeter.value = lod = 10;
    else lodMeter.value = lod = 11;
});

function toSampleSpace (px) {
    return offset + 2 * 4 * px * sampleWindow / viewportWidth;
}

canvas.addEventListener("click", (e) => {
    const rect = e.target.getBoundingClientRect();
    const x = (event.clientX - rect.left) / devicePixelRatio;
    const s = toSampleSpace(x);
    cuePosition = Math.floor(s);

    gl.uniform1i(cueSampleLocation, cuePosition);
});

// Start the animation
animate();
