/*
 *  Copyright (c) 2020 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/*
 * This is a worker doing the encode/decode transformations to add end-to-end
 * encryption to a WebRTC PeerConnection using the Insertable Streams API.
 */

'use strict';
let currentCryptoKey;
let encrypt = false;
let decrypt = false;

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
const sendCounts = new Map();

// If using crypto offset (controlled by a checkbox):
// Do not encrypt the first couple of bytes of the payload. This allows
// a middle to determine video keyframes or the opus mode being used.
// For VP8 this is the content described in
//   https://tools.ietf.org/html/rfc6386#section-9.1
// which is 10 bytes for key frames and 3 bytes for delta frames.
// For opus (where encodedFrame.type is not set) this is the TOC byte from
//   https://tools.ietf.org/html/rfc6716#section-3.1
//
// It makes the (encrypted) video and audio much more fun to watch and listen to
// as the decoder does not immediately throw a fatal error.
const UNENCRYPTED_BYTES = {
    key: 10,
    delta: 3,
    undefined: 1 // frame.type is not set on audio
};

function dump(encodedFrame, direction, max = 16) {
    const data = new Uint8Array(encodedFrame.data);
    let bytes = '';
    for (let j = 0; j < data.length && j < max; j++) {
        bytes += (data[j] < 16 ? '0' : '') + data[j].toString(16) + ' ';
    }
    console.log(performance.now().toFixed(2), direction, bytes.trim(),
        'len=' + encodedFrame.data.byteLength,
        'type=' + (encodedFrame.type || 'audio'),
        'ts=' + encodedFrame.timestamp,
        'ssrc=' + encodedFrame.getMetadata().synchronizationSource,
        'pt=' + (encodedFrame.getMetadata().payloadType || '(unknown)')
    );
}

let scount = 0;
function encodeFunction(encodedFrame, controller) {
    if (scount++ < 30) { // dump the first 30 packets.
        dump(encodedFrame, 'send');
    }
    if (currentCryptoKey && encrypt) {
        const iv = makeIV(encodedFrame.getMetadata().synchronizationSource, encodedFrame.timestamp);

        // Thіs is not encrypted and contains the VP8 payload descriptor or the Opus TOC byte.
        const frameHeader = new Uint8Array(encodedFrame.data, 0, UNENCRYPTED_BYTES[encodedFrame.type]);

        // Frame trailer contains the R|IV_LENGTH and key index
        const frameTrailer = new Uint8Array(2);

        frameTrailer[0] = IV_LENGTH;
        frameTrailer[1] = /*keyIndex*/0;

        // Construct frame trailer. Similar to the frame header described in
        // https://tools.ietf.org/html/draft-omara-sframe-00#section-4.2
        // but we put it at the end.
        //
        // ---------+-------------------------+-+---------+----
        // payload  |IV...(length = IV_LENGTH)|R|IV_LENGTH|KID |
        // ---------+-------------------------+-+---------+----

        return crypto.subtle.encrypt({
                name: ENCRYPTION_ALGORITHM,
                iv,
                additionalData: new Uint8Array(encodedFrame.data, 0, frameHeader.byteLength)
            }, currentCryptoKey, new Uint8Array(encodedFrame.data,
                UNENCRYPTED_BYTES[encodedFrame.type])
        ).then(cipherText => {
            const newData = new ArrayBuffer(frameHeader.byteLength + cipherText.byteLength
                + iv.byteLength + frameTrailer.byteLength);
            const newUint8 = new Uint8Array(newData);

            newUint8.set(frameHeader); // copy first bytes.
            newUint8.set(
                new Uint8Array(cipherText), frameHeader.byteLength); // add ciphertext.
            newUint8.set(
                new Uint8Array(iv), frameHeader.byteLength + cipherText.byteLength); // append IV.
            newUint8.set(
                frameTrailer,
                frameHeader.byteLength + cipherText.byteLength + iv.byteLength); // append frame trailer.

            encodedFrame.data = newData;

            return controller.enqueue(encodedFrame);
        });
    }

    controller.enqueue(encodedFrame);
}

let rcount = 0;
async function decodeFunction(encodedFrame, controller) {
    if (rcount++ < 30) { // dump the first 30 packets
        dump(encodedFrame, 'recv');
    }
    if (currentCryptoKey && decrypt) {
        // Construct frame trailer. Similar to the frame header described in
        // https://tools.ietf.org/html/draft-omara-sframe-00#section-4.2
        // but we put it at the end.
        //
        // ---------+-------------------------+-+---------+----
        // payload  |IV...(length = IV_LENGTH)|R|IV_LENGTH|KID |
        // ---------+-------------------------+-+---------+----

        const frameHeader = new Uint8Array(encodedFrame.data, 0, UNENCRYPTED_BYTES[encodedFrame.type]);
        const frameTrailer = new Uint8Array(encodedFrame.data, encodedFrame.data.byteLength - 2, 2);

        const ivLength = frameTrailer[0];
        const iv = new Uint8Array(
            encodedFrame.data,
            encodedFrame.data.byteLength - ivLength - frameTrailer.byteLength,
            ivLength);

        const cipherTextStart = frameHeader.byteLength;
        const cipherTextLength = encodedFrame.data.byteLength
            - (frameHeader.byteLength + ivLength + frameTrailer.byteLength);

        const plainText = await crypto.subtle.decrypt({
                name: 'AES-GCM',
                iv,
                additionalData: new Uint8Array(encodedFrame.data, 0, frameHeader.byteLength)
            },
            currentCryptoKey,
            new Uint8Array(encodedFrame.data, cipherTextStart, cipherTextLength)
        );

        const newData = new ArrayBuffer(frameHeader.byteLength + plainText.byteLength);
        const newUint8 = new Uint8Array(newData);

        newUint8.set(new Uint8Array(encodedFrame.data, 0, frameHeader.byteLength));
        newUint8.set(new Uint8Array(plainText), frameHeader.byteLength);

        encodedFrame.data = newData;
    }
    controller.enqueue(encodedFrame);
}

function handleTransform(operation, readable, writable) {
    if (operation === 'encode') {
        const transformStream = new TransformStream({
            transform: encodeFunction,
        });
        readable
            .pipeThrough(transformStream)
            .pipeTo(writable);
    } else if (operation === 'decode') {
        const transformStream = new TransformStream({
            transform: decodeFunction,
        });
        readable
            .pipeThrough(transformStream)
            .pipeTo(writable);
    }
}

/**
 * Construct the IV used for AES-GCM and sent (in plain) with the packet similar to
 * https://tools.ietf.org/html/rfc7714#section-8.1
 * It concatenates
 * - the 32 bit synchronization source (SSRC) given on the encoded frame,
 * - the 32 bit rtp timestamp given on the encoded frame,
 * - a send counter that is specific to the SSRC. Starts at a random number.
 * The send counter is essentially the pictureId but we currently have to implement this ourselves.
 * There is no XOR with a salt. Note that this IV leaks the SSRC to the receiver but since this is
 * randomly generated and SFUs may not rewrite this is considered acceptable.
 * The SSRC is used to allow demultiplexing multiple streams with the same key, as described in
 *   https://tools.ietf.org/html/rfc3711#section-4.1.1
 * The RTP timestamp is 32 bits and advances by the codec clock rate (90khz for video, 48khz for
 * opus audio) every second. For video it rolls over roughly every 13 hours.
 * The send counter will advance at the frame rate (30fps for video, 50fps for 20ms opus audio)
 * every second. It will take a long time to roll over.
 *
 * See also https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams
 */
function makeIV(synchronizationSource, timestamp) {
    const iv = new ArrayBuffer(IV_LENGTH);
    const ivView = new DataView(iv);

    // having to keep our own send count (similar to a picture id) is not ideal.
    if (!sendCounts.has(synchronizationSource)) {
        // Initialize with a random offset, similar to the RTP sequence number.
        sendCounts.set(synchronizationSource, Math.floor(Math.random() * 0xFFFF));
    }

    const sendCount = sendCounts.get(synchronizationSource);

    ivView.setUint32(0, synchronizationSource);
    ivView.setUint32(4, timestamp);
    ivView.setUint32(8, sendCount % 0xFFFF);

    sendCounts.set(synchronizationSource, sendCount + 1);

    return iv;
}

// Handler for messages, including transferable streams.
onmessage = (event) => {
    if (event.data.operation === 'encode' || event.data.operation === 'decode') {
        return handleTransform(event.data.operation, event.data.readable, event.data.writable);
    }
    if (event.data.operation === 'setKey') {
        currentCryptoKey = event.data.key;
        encrypt = event.data.encrypt;
        decrypt = event.data.decrypt;
        console.log('key has been set');
    }
};

// Handler for RTCRtpScriptTransforms.
if (self.RTCTransformEvent) {
    self.onrtctransform = (event) => {
        const transformer = event.transformer;
        handleTransform(transformer.options.operation, transformer.readable, transformer.writable);
    };
}
