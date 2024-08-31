//@ts-check

/** @type {HTMLCanvasElement} */
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('webgl-canvas'));
/** @type {WebGL2RenderingContext} */
const gl = canvas.getContext("webgl2", { antialias: false });

const width = canvas.clientWidth;
const height = canvas.clientHeight;
const devicePixelRatio = window.devicePixelRatio || 1;

canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
canvas.style.width = width + 'px';
canvas.style.height = height + 'px';

/** @param {number} viewportWidth current width of the viewport, compensating for devicePixelRatio */
let viewportWidth = canvas.width;
/** @param {number} viewportHeight current height of the viewport, compensating for devicePixelRatio */
let viewportHeight = canvas.height;
function setViewport () {
    viewportWidth = canvas.width;
    viewportHeight = canvas.height;
    gl.viewport(0, 0, viewportWidth, viewportHeight);
}
setViewport()

// Vertex Shader Source
const vertexShaderSource = await fetch("/shaders/vertex.glsl").then((res) => res.text())
// Fragment Shader Source
const fragmentShaderSource = await fetch("/shaders/fragment.glsl").then((res) => res.text())


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
const channelData = audioBuffer.getChannelData(0).slice(0); // slice the buffer so it doesn't get detached after using it in the audio context, we keep the decoded audio data in memory indefinitely
const sampleRate = audioBuffer.sampleRate;
const channelDataSize = channelData.length;

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

/** @param {number} cuePosition position of CUE marker in samples from the beginning of the track */
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


/** @param {number} textureWidth width of the data texture in texels */
const textureWidth = gl.getParameter(gl.MAX_TEXTURE_SIZE) // usually no more than 8k
// we can only replace the texture data in square blocks through textSubImage2D
/** @param {number} lodBlockSize size of the block in samples/px */
const lodBlockSize = (Math.ceil(viewportWidth / textureWidth) + 2) * textureWidth

/** @param {number} lods synthetic levels of detail/zoom we're rendering */
const lods = 12;
/** @param {number} size size of the texture in texels */
const size = lods*lodBlockSize
/** @param {number} bufferSize size of the array buffer that contains the texture */
const bufferSize = size * 2 // 2 channels per texture (RG)

/** @param {number} textureHeight height of the data texture in texels */
const textureHeight = Math.floor(size / textureWidth); // should not need flooring

// console.log(`Texture size: ${size*4/(1024**2)} MB`)


const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);

// setup texture
gl.texImage2D(
    gl.TEXTURE_2D,
    0,                      // Level of detail (0 is the base level)
    gl.RG32F,               // Internal format
    textureWidth,           // Width of each layer
    textureHeight,          // Height of each layer
    0,                      // Border (must be 0)
    gl.RG,                  // Format of the texel data
    gl.FLOAT,               // Data type of the texel data
    new Float32Array(bufferSize)  // texels
);


function getXOffsetForLod (lod) {
    return 0
}
function getYOffsetForLod (lod) {
    return Math.floor(lodBlockSize / textureWidth) * lod
}
/**
 * Dynamically upload data to the texture (virtual texturing)
 * @param {number} start target start sample
 * @param {number} window target window sample
 * @param {number} lod level of detail aka zoom level
 */
function uploadData (start, window, lod) {
    /** @param {number} f factor to scale the data down by */
    const f = 2 ** lod;

    const offsetX = getXOffsetForLod(lod)
    const offsetY = getYOffsetForLod(lod)

    const lodBlockHeight = Math.floor(lodBlockSize / textureWidth)

    const fViewportWidth = viewportWidth * f
    const fLodBlockSize = lodBlockSize * f

    const offsetIndexStart = Math.max(
        0,
        (Math.round(start / fViewportWidth) * fViewportWidth) + .5 * fViewportWidth - .5 * fLodBlockSize
    )
    const offsetIndexEnd = Math.min(
        offsetIndexStart + fLodBlockSize,
        channelDataSize
    )

    const data = channelData.slice(offsetIndexStart, offsetIndexEnd);
    virtualTextureOffset[lod] = offsetIndexStart

    const dataTargetTexels = lodBlockSize
    const dataTargetBuffer = dataTargetTexels * 2;


    console.time(`generateMipmap ${lod} for range: ${offsetIndexStart}:${offsetIndexEnd}`);
    const samples = new Float32Array(dataTargetBuffer);
    for (let i = 0; i <= dataTargetTexels; i += 1) {
        const stepSize = f;

        const r = 2*i
        const g = 2*i + 1

        if (lod === 0) {
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
    console.timeEnd(`generateMipmap ${lod} for range: ${offsetIndexStart}:${offsetIndexEnd}`);


    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        offsetX,
        offsetY,
        textureWidth,
        lodBlockHeight,
        gl.RG,
        gl.FLOAT,
        samples
    )

    renderedWindow[lod][0] = offsetIndexStart;
    renderedWindow[lod][1] = offsetIndexEnd;
}

gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);


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

const lodBlockSizeLocation = gl.getUniformLocation(program, "uLodBlockSize");
const virtualTextureOffsetLocation = gl.getUniformLocation(program, "uVirtualTextureOffsets");

let sampleWindow = viewportWidth; // start with 1 sample per pixel
let lod = 0;
let offset = 0;
let virtualTextureOffset = new Array(lods).fill(0);

gl.uniform1i(windowLocation, sampleWindow);
gl.uniform1i(lodLocation, lod);
gl.uniform1i(textureWidthLocation, textureWidth);
gl.uniform1i(offsetLocation, offset);

gl.uniform1i(playbackPositionLocation, cuePosition);
gl.uniform1i(cueSampleLocation, cuePosition);

gl.uniform1i(widthLocation, viewportWidth);
gl.uniform1i(heightLocation, viewportHeight);

gl.uniform1i(lodBlockSizeLocation, lodBlockSize);
gl.uniform1iv(virtualTextureOffsetLocation, virtualTextureOffset);

// Bind Texture Unit
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, texture);

const renderedWindow = new Array(lods).fill(0).map(() => new Array(2).fill(0));

const offsetIndicator = /** @type {HTMLInputElement} */ (document.getElementById("offset"));

function animate() {
    if (Math.max(0, offset) < renderedWindow[lod][0] || Math.min(offset+(sampleWindow*2), channelDataSize) > renderedWindow[lod][1]) {
        uploadData(offset, sampleWindow, lod);
    }

    gl.uniform1i(offsetLocation, offset);
    gl.uniform1i(windowLocation, sampleWindow);
    gl.uniform1i(lodLocation, lod) // -

    gl.uniform1i(widthLocation, canvas.width); // -
    gl.uniform1i(heightLocation, canvas.height); // -

    gl.uniform1i(lodBlockSizeLocation, lodBlockSize); // -
    gl.uniform1iv(virtualTextureOffsetLocation, virtualTextureOffset); // -

    gl.uniform1i(playbackPositionLocation, getActiveSample());

    offsetIndicator.value = String(offset);


    // Set Viewport and Draw
    setViewport();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(animate);
}

const settingsForm = /** @type {HTMLFormElement} */ (document.getElementById("settings"));

settingsForm.elements["window"].value = sampleWindow;

settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sampleWindow = parseInt(e.target['window'].value);
});

const lodMeter = /** @type {HTMLInputElement} */ (document.getElementById("lod"));
canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (!(e.currentTarget instanceof HTMLElement)) throw new Error("target is not HTMLElement")

    if (e.ctrlKey || e.metaKey) { // pinch zoom
        const step = e.deltaY * Math.floor(sampleWindow / 20)

        const minSize = viewportWidth
        sampleWindow = Math.max(sampleWindow + step, minSize);
        settingsForm.elements["window"].value = sampleWindow;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / devicePixelRatio;
        offset -= Math.round(8 * step * (x / viewportWidth)); // no idea where that 4 comes from it just works (4*2)

        // hacky way to set LOD
        {
            const pwr = Math.floor(Math.log2(sampleWindow / viewportWidth));
            lod = Math.max(0, Math.min(lods - 1, pwr));
            lodMeter.value = String(lod);
        }
    }

    const step = e.deltaX * Math.floor(sampleWindow / 200)
    offset += Math.round(step); // no idea where that 4 comes from it just works (4*2)
});

function toSampleSpace (px) {
    return offset + 2 * 4 * px * sampleWindow / viewportWidth;
}

canvas.addEventListener("click", (e) => {
    e.preventDefault();
    if (!(e.currentTarget instanceof HTMLElement)) throw new Error("target is not HTMLElement")

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / devicePixelRatio;
    const s = toSampleSpace(x);
    cuePosition = Math.floor(s);

    gl.uniform1i(cueSampleLocation, cuePosition);
});

// Start the animation
animate();
