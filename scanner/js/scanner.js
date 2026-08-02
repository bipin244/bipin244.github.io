/**
 * Fast 1D barcode scanner for CCTV serial stickers (Code 128).
 * Strategy: own camera stream + crop center strip + ZXing OneD on canvas.
 * Includes autofocus / rear-camera fixes for phones that open soft (e.g. OnePlus).
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
  let torchOn = false;
  let tapBound = false;

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
      return 'Camera needs HTTPS. Open the site over https:// (or localhost), not http://.';
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

  function getVideoTrack() {
    return mediaStream?.getVideoTracks?.()[0] || null;
  }

  /**
   * Prefer the main rear camera — skip ultra-wide / front when labels exist.
   * Soft/blurry previews on OnePlus & similar often come from the ultra-wide lens.
   */
  async function pickPreferredCameraId() {
    try {
      // Need a quick permission probe so labels are populated
      const probe = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      probe.getTracks().forEach(t => t.stop());
    } catch (e) { /* ignore — enumerate may still work */ }

    let devices = [];
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch (e) {
      return null;
    }

    const cameras = devices.filter(d => d.kind === 'videoinput' && d.deviceId);
    if (!cameras.length) return null;

    const scored = cameras.map((d, index) => {
      const label = (d.label || '').toLowerCase();
      let score = 0;
      if (/back|rear|environment|world|facing back/.test(label)) score += 20;
      if (/camera2?\s*0|0,\s*facing back|^0\b/.test(label)) score += 8;
      if (/ultra|uw\b|wide angle|wide-angle/.test(label)) score -= 30;
      if (/tele|macro/.test(label)) score -= 8;
      if (/front|user|face|facing front|selfie/.test(label)) score -= 40;
      // Prefer earlier back cameras when unlabeled (often main sensor)
      score -= index * 0.1;
      return { id: d.deviceId, label, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.id || null;
  }

  async function tryGetUserMedia(constraints) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  async function requestStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support camera access.');
    }

    const deviceId = await pickPreferredCameraId();
    const attempts = [];

    if (deviceId) {
      attempts.push({
        audio: false,
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        }
      });
      attempts.push({
        audio: false,
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      attempts.push({
        audio: false,
        video: { deviceId: { exact: deviceId } }
      });
    }

    attempts.push(
      {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
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
      { audio: false, video: { facingMode: { exact: 'environment' } } },
      { audio: false, video: { facingMode: 'environment' } },
      { audio: false, video: true }
    );

    let lastErr;
    for (const c of attempts) {
      try {
        return await tryGetUserMedia(c);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Could not open camera');
  }

  /**
   * Continuous AF / exposure / mild zoom — critical for sharp stickers on Android.
   */
  async function applyFocusEnhancements(track) {
    if (!track?.applyConstraints) return;
    const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
    const advanced = [];

    if (Array.isArray(caps.focusMode)) {
      if (caps.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      } else if (caps.focusMode.includes('single-shot')) {
        advanced.push({ focusMode: 'single-shot' });
      }
    }

    if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
      advanced.push({ exposureMode: 'continuous' });
    }

    if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
      advanced.push({ whiteBalanceMode: 'continuous' });
    }

    // Slight zoom helps many phones lock AF on close serial stickers
    if (caps.zoom && typeof caps.zoom.min === 'number') {
      const min = caps.zoom.min;
      const max = caps.zoom.max ?? min;
      const zoom = Math.min(max, Math.max(min, Math.min(2, min + 0.8)));
      if (zoom > min) advanced.push({ zoom });
    }

    if (!advanced.length) return;

    try {
      await track.applyConstraints({ advanced });
    } catch (e) {
      for (const constraint of advanced) {
        try {
          await track.applyConstraints({ advanced: [constraint] });
        } catch (err) { /* capability may be listed but not writable */ }
      }
    }
  }

  /** Tap / button: nudge autofocus (helps when preview stays soft). */
  async function refocus() {
    const track = getVideoTrack();
    if (!track?.applyConstraints) return false;
    const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
    const modes = Array.isArray(caps.focusMode) ? caps.focusMode : [];

    try {
      if (modes.includes('single-shot')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
        await new Promise(r => setTimeout(r, 350));
      }
      if (modes.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      }
      // Zoom nudge can re-trigger AF on OxygenOS / MIUI
      if (caps.zoom && typeof caps.zoom.min === 'number') {
        const settings = track.getSettings?.() || {};
        const min = caps.zoom.min;
        const max = caps.zoom.max ?? min;
        const current = settings.zoom ?? min;
        const bump = Math.min(max, current + 0.15);
        const back = Math.min(max, Math.max(min, current));
        await track.applyConstraints({ advanced: [{ zoom: bump }] });
        await new Promise(r => setTimeout(r, 120));
        await track.applyConstraints({ advanced: [{ zoom: back }] });
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function supportsTorch() {
    const track = getVideoTrack();
    if (!track?.getCapabilities) return false;
    const caps = track.getCapabilities();
    return !!(caps.torch || (Array.isArray(caps.fillLightMode) && caps.fillLightMode.includes('flash')));
  }

  async function setTorch(on) {
    const track = getVideoTrack();
    if (!track?.applyConstraints) return false;
    const caps = track.getCapabilities?.() || {};
    try {
      if (caps.torch) {
        await track.applyConstraints({ advanced: [{ torch: !!on }] });
        torchOn = !!on;
        return true;
      }
      if (Array.isArray(caps.fillLightMode)) {
        await track.applyConstraints({
          advanced: [{ fillLightMode: on ? 'flash' : 'off' }]
        });
        torchOn = !!on;
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function syncScanControls() {
    const $torch = $('#btn-scan-torch');
    if ($torch.length) {
      const ok = supportsTorch();
      $torch.toggleClass('d-none', !ok);
      $torch.toggleClass('active', torchOn);
      $torch.attr('aria-pressed', torchOn ? 'true' : 'false');
      $torch.find('i').attr('class', torchOn ? 'bi bi-flashlight-fill' : 'bi bi-flashlight');
    }
  }

  function bindUiOnce() {
    if (tapBound) return;
    tapBound = true;

    $(document).on('click', '#scanner-video, #btn-scan-refocus', async (e) => {
      e.preventDefault();
      if (!scanning) return;
      $('#scan-status').text('Refocusing…');
      await refocus();
      if (scanning) $('#scan-status').text('Hold steady — fill the green box');
    });

    $(document).on('click', '#btn-scan-torch', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!scanning) return;
      const next = !torchOn;
      const ok = await setTorch(next);
      if (!ok) showToast('Torch not available on this camera', 'warning');
      syncScanControls();
    });
  }

  /**
   * Draw a horizontal crop (barcode strip) from video → canvas
   */
  function grabCrop(scale = 1) {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh) return false;

    // Center strip ~92% wide × ~28% tall — matches sticker barcodes
    const cw = Math.max(200, Math.floor(vw * 0.92));
    const ch = Math.max(80, Math.floor(vh * 0.28));
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

    if (now - lastTry < 65) return;
    lastTry = now;

    if (!videoEl || videoEl.readyState < 2) return;

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
    bindUiOnce();

    videoEl = video;
    onResult = callback;
    scanning = true;
    torchOn = false;

    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;
    video.autoplay = true;
    // Hint browsers to prefer sharp frames over smooth playback
    try { video.disablePictureInPicture = true; } catch (e) { /* ignore */ }

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

    const track = getVideoTrack();
    await applyFocusEnhancements(track);
    // Second pass after a short settle — some Androids ignore the first AF apply
    setTimeout(() => {
      if (scanning) applyFocusEnhancements(getVideoTrack());
    }, 500);

    syncScanControls();

    lastTry = 0;
    rafId = requestAnimationFrame(tick);
  }

  async function stop() {
    scanning = false;
    onResult = null;
    torchOn = false;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    if (reader) {
      try { reader.reset(); } catch (e) { /* ignore */ }
      reader = null;
    }

    if (mediaStream) {
      try { await setTorch(false); } catch (e) { /* ignore */ }
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }

    if (videoEl) {
      try { videoEl.pause(); } catch (e) { /* ignore */ }
      videoEl.srcObject = null;
      videoEl = null;
    }

    syncScanControls();
    $('#btn-scan-torch').addClass('d-none');
  }

  function isScanning() {
    return scanning;
  }

  return {
    start,
    stop,
    isScanning,
    explainError,
    isSecure,
    ensureLibrary,
    refocus,
    setTorch,
    supportsTorch
  };
})();
