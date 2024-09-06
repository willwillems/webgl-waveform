// @ts-check
/// <reference lib="webworker" />

const TEXEL_CHANNELS = 2;

onmessage = function(e) {
    const { offsetIndexStart, offsetIndexEnd, lod } = e.data;
    // buffers are transfered
    const data = new Float32Array(e.data.data, offsetIndexStart * e.data.data.BYTES_PER_ELEMENT, offsetIndexEnd - offsetIndexStart);
    const texels = new Float32Array(e.data.texels.buffer);

    /** @param {number} f factor to scale the data down by */
    const f = 2 ** lod;
    /** @type {number} data amount target for texel data in amount of texels */
    const dataTargetTexels = texels.length / TEXEL_CHANNELS; // 2 values per texel (r, g)


    for (let i = 0; i <= dataTargetTexels; i += 1) {
        const stepSize = f;

        const r = 2*i;
        const g = 2*i + 1;

        if (lod === 0) {
            texels[r] = data[i] / 1.4;
            texels[g] = data[i+1] / 1.4;
            continue;
        }

        const bucketStart = i * stepSize - 1;
        const bucketEnd = i * stepSize + 2 * stepSize + 1;

        if (data[bucketStart] === undefined && bucketStart > 0) {
            break;
        }

        let min = data[bucketStart] ?? 0;
        let max = data[bucketStart] ?? 0;
        for (let j = bucketStart; j <= bucketEnd; j += 1) {
            const v = data[j];

            min = v < min ? v : min;
            max = v > max ? v : max;
        }

        texels[r] = data[bucketStart] <= data[bucketEnd] ? min / 1.4 : max / 1.4;
        texels[g] = data[bucketStart] <= data[bucketEnd] ? max / 1.4 : min / 1.4;
    }

    self.postMessage({ data, texels, offsetIndexStart, offsetIndexEnd, lod }, [texels.buffer]);
};
