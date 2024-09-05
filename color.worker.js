// @ts-check
/// <reference lib="webworker" />

import { RFFT } from "https://esm.sh/fftw-js";
const TEXEL_CHANNELS = 3;

// fil buffer with zeros
const getPaddedSlice = (arr, start, length, padding = 2) => {
    const leftTarget = start - padding * length
    const rightTarget = start + (1 + padding) * length

    const leftBound = Math.max(0, leftTarget)
    const rightBound = Math.min(arr.length, rightTarget)

    const leftPad = leftBound - leftTarget
    const rightPad = rightTarget - rightBound

    // todo: create data view
    const extendedSlice = new Float32Array([
        ...Array(leftPad).fill(0),
        ...arr.slice(leftBound, rightBound),
        ...Array(rightPad).fill(0),
    ]);

    return extendedSlice;
}


function computeMagnitudes(fftwResult, windowSize) {
  const halfWindowSize = windowSize / 2;
  const magnitudes = [];

  // Calculate magnitudes for the first half of the FFT result
  for (let i = 0; i < halfWindowSize/2; i++) {
    const real = fftwResult[i * 2];
    const imag = fftwResult[i * 2 + 1];
    const magnitude = Math.sqrt(real * real + imag * imag);
    magnitudes.push(magnitude);
  }

  return magnitudes;
}
// TODO: function args instead?
// add 2 aditional windows to the left and right
const sampleSize = 442
const windowPadding = 2
const windowSize = sampleSize * (1 + 2 * windowPadding)


onmessage = function(e) {
    const { } = e.data;
    // buffers are transfered
    const data = new Float32Array(e.data.data.buffer);
    const colors = new Uint8Array(e.data.colors.buffer);

    var plan = new RFFT(windowSize)

    // var fftr = new KissFFT.FFTR(442*2);
    let ci = 0;
    for (var i = 0; i < data.length; i += sampleSize) {
        const transform = plan.forward(getPaddedSlice(data, i, sampleSize, windowPadding));

        const magnitudes = computeMagnitudes(transform, windowSize)

        // •	Low Range (20 Hz to 250 Hz): 0 to 0.0125
        // •	Mid Range (250 Hz to 4 kHz): 0.0125 to 0.2
        // •	High Range (4 kHz to 20 kHz): 0.2 to 1

        // // good values without the padding on left and right
        // const lowS = 442/2 * 0.015
        // const midS = 442/2 * 0.035

        const lowS = sampleSize/2 * 0.05
        const midS = sampleSize/2 * 0.25

        const low = magnitudes.slice(0, lowS).reduce((acc, val) => acc + val, 0)
        const mid = magnitudes.slice(lowS, midS).reduce((acc, val) => acc + val, 0)
        const high = magnitudes.slice(midS).reduce((acc, val) => acc + val, 0)

        const lowNormalised = low / Math.max(low, mid, high)
        const midNormalised = mid / Math.max(low, mid, high)
        const highNormalised = high / Math.max(low, mid, high)

        colors[ci++] = Math.round(lowNormalised * 200)
        colors[ci++] = Math.round(midNormalised * 200)
        colors[ci++] = Math.round(highNormalised * 200)
    }
    plan.dispose();  // fftr is now no longer usable for FFTs

    self.postMessage({ data, colors }, [data.buffer, colors.buffer]);
};
