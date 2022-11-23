const worker = new Worker('/e2ee_worker.js', {name: 'E2EE worker'});

export function setKey(key) {
    worker.postMessage({
        operation: 'setKey',
        key,
        encrypt: true,
        decrypt: true
    });
}

export function setupSenderTransform(sender) {
    if (window.RTCRtpScriptTransform) {
        sender.transform = new RTCRtpScriptTransform(worker, {operation: 'encode'});
        return;
    }

    const senderStreams = sender.createEncodedStreams();
    // Instead of creating the transform stream here, we do a postMessage to the worker. The first
    // argument is an object defined by us, the second is a list of variables that will be transferred to
    // the worker. See
    //   https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage
    const {readable, writable} = senderStreams;
    worker.postMessage({
        operation: 'encode',
        readable,
        writable,
    }, [readable, writable]);
}

export function setupReceiverTransform(receiver) {
    if (window.RTCRtpScriptTransform) {
        receiver.transform = new RTCRtpScriptTransform(worker, {operation: 'decode'});
        return;
    }

    const receiverStreams = receiver.createEncodedStreams();
    const {readable, writable} = receiverStreams;
    worker.postMessage({
        operation: 'decode',
        readable,
        writable,
    }, [readable, writable]);
}

window.setKey = function(base64key, encrypt, decrypt) {
    const jwkKey = JSON.parse(atob(base64key));
    crypto.subtle.importKey('jwk', jwkKey, 'AES-GCM', false, ['encrypt','decrypt']).then(key => {
    worker.postMessage({
        operation: 'setKey',
        key,
        encrypt,
        decrypt
    });
});
}
