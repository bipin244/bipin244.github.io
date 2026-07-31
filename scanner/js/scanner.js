/**
 * Fast 1D barcode scanner for CCTV serial stickers (Code 128).
 * Strategy: own camera stream + crop center strip + ZXing OneD on canvas.
 * Cropping the scan region is much faster/more accurate than full-frame decode.
 */

const Scanner = (() => {
  let videoEl = null;
  let canvasEl = null;
  let ctx = null;
  let reader = null;
  let mediaStream = null;
  let onResult = null;
  let scanning = false;
  let rafId = 0;
  let lastTry = 0;

  function isSecure() {
    return window.isSecureContext === true ||
      location.protocol === 'https:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';
  }

  function explainError(err) {
    const name = err?.name || '';
    const msg = err?.message || String(err || 'Unknown error');

    if (!isSecure()) {
      return 'Camera needs HTTPS. Open https://parag-camera.loca.lt (or localhost), not http://.';
    }
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Camera permission denied. Tap Allow, or enable Camera in site settings.';
    }
    if (name === 'NotFoundError') return 'No camera found on this device.';
    if (name === 'NotReadableError') {
      return 'Camera is busy. Close other camera apps and try again.';
    }
    if (name === 'SecurityError') {
      return 'Browser blocked the camera. Use HTTPS and allow camera access.';
    }
    if (/not loaded|ZXing/i.test(msg)) {
      return 'Scanner library missing. Hard-refresh the page and try again.';
    }
    return msg;
  }

  function getZXing() {
    return window.ZXingBrowser || null;
  }

  async function ensureLibrary() {
    if (getZXing()?.BrowserMultiFormatOneDReader || getZXing()?.BrowserMultiFormatReader) {
      return;
    }
    const sources = [
      'js/vendor/zxing-browser.min.js',
      'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js'
    ];
    for (const src of sources) {
      try {
        await loadScript(src);
        if (getZXing()) return;
      } catch (e) { /* try next */ }
    }
    throw new Error('ZXing scanner library not loaded');
  }

  function createReader() {
    const Z = getZXing();
    if (Z.BrowserMultiFormatOneDReader) {
      return new Z.BrowserMultiFormatOneDReader(undefined, {
        delayBetweenScanAttempts: 0,
        delayBetweenScanSuccess: 500,
        tryPlayVideoTimeout: 10000
      });
    }
    return new Z.BrowserMultiFormatReader();
  }

  async function requestStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support camera access.');
    }
    const attempts = [
      {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      },
      {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      { audio: false, video: { facingMode: 'environment' } },
      { audio: false, video: true }
    ];
    let lastErr;
    for (const c of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(c);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Could not open camera');
  }

  /**
   * Draw a horizontal crop (barcode strip) from video → canvas
   */
  function grabCrop(scale = 1) {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh) return false;

    // Center strip ~92% wide × ~32% tall — matches sticker barcodes
    const cw = Math.max(200, Math.floor(vw * 0.92));
    const ch = Math.max(80, Math.floor(vh * 0.32));
    const sx = Math.floor((vw - cw) / 2);
    const sy = Math.floor((vh - ch) / 2);

    const outW = Math.floor(cw * scale);
    const outH = Math.floor(ch * scale);
    if (canvasEl.width !== outW) canvasEl.width = outW;
    if (canvasEl.height !== outH) canvasEl.height = outH;

    ctx.imageSmoothingEnabled = scale !== 1;
    ctx.drawImage(videoEl, sx, sy, cw, ch, 0, 0, outW, outH);
    return true;
  }

  function tryDecode() {
    if (!reader || !canvasEl) return null;
    try {
      // Sync decode — throws NotFoundException when nothing found
      const result = reader.decodeFromCanvas(canvasEl);
      if (!result) return null;
      const text = (result.getText ? result.getText() : String(result)).trim();
      return text || null;
    } catch (e) {
      return null;
    }
  }

  function tick(now) {
    if (!scanning) return;
    rafId = requestAnimationFrame(tick);

    // ~15 attempts/sec
    if (now - lastTry < 65) return;
    lastTry = now;

    if (!videoEl || videoEl.readyState < 2) return;

    // Try normal crop, then 1.5× upscaled crop (helps thin bars)
    if (grabCrop(1)) {
      let text = tryDecode();
      if (!text && grabCrop(1.5)) text = tryDecode();
      if (!text && grabCrop(2)) text = tryDecode();
      if (text && onResult) onResult(text);
    }
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {function(string): void} callback
   */
  async function start(video, callback) {
    if (scanning) await stop();

    if (!isSecure()) {
      throw Object.assign(new Error(explainError({ name: 'SecurityError' })), { name: 'SecurityError' });
    }

    await ensureLibrary();
    reader = createReader();

    videoEl = video;
    onResult = callback;
    scanning = true;

    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;
    video.autoplay = true;

    if (!canvasEl) {
      canvasEl = document.createElement('canvas');
      ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    }

    mediaStream = await requestStream();
    video.srcObject = mediaStream;
    await new Promise((resolve) => {
      const done = () => {
        video.removeEventListener('loadedmetadata', done);
        resolve();
      };
      if (video.readyState >= 1) resolve();
      else video.addEventListener('loadedmetadata', done);
      setTimeout(resolve, 1500);
    });
    try {
      await video.play();
    } catch (e) { /* ignore */ }

    lastTry = 0;
    rafId = requestAnimationFrame(tick);
  }

  async function stop() {
    scanning = false;
    onResult = null;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    if (reader) {
      try { reader.reset(); } catch (e) { /* ignore */ }
      reader = null;
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }

    if (videoEl) {
      try { videoEl.pause(); } catch (e) { /* ignore */ }
      videoEl.srcObject = null;
      videoEl = null;
    }
  }

  function isScanning() {
    return scanning;
  }

  return { start, stop, isScanning, explainError, isSecure, ensureLibrary };
})();
