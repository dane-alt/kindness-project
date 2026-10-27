// Fake microphone + fake speech recognition, injected before the page loads.
// Chromium also gets a real fake-device mic via launch flags; WebKit on Linux has no fake-mic flag,
// so getUserMedia is replaced with a generated tone stream (still a real MediaStream fed to MediaRecorder).
export async function fakeMic(page, { deny = false, speech = true } = {}) {
  await page.addInitScript(({ deny, speech }) => {
    const orig = navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__micCalls = 0;
    const tone = () => { const C = window.AudioContext || window.webkitAudioContext; const ctx = new C(); const o = ctx.createOscillator(); const d = ctx.createMediaStreamDestination(); o.connect(d); o.start(); return d.stream; };
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {} });
    navigator.mediaDevices.getUserMedia = async (c) => {
      window.__micCalls++;
      if (deny) throw new DOMException('Permission denied', 'NotAllowedError');
      try { if (orig) return await orig(c); } catch (e) {}
      return tone();
    };
    if (typeof window.MediaRecorder === 'undefined') {
      window.MediaRecorder = class { static isTypeSupported(t) { return t.startsWith('audio/mp4'); }
        constructor(s, o) { this.mimeType = (o && o.mimeType) || 'audio/mp4'; this.state = 'inactive'; }
        start() { this.state = 'recording'; } stop() { this.state = 'inactive'; this.ondataavailable && this.ondataavailable({ data: new Blob(['x'], { type: this.mimeType }) }); this.onstop && this.onstop(); } };
      window.__fakeRecorder = true;
    }
    if (speech) {
      class FakeSR { start() { setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'My neighbor shoveled my driveway' }], { isFinal: true })] }), 300); } stop() {} }
      window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
    } else { try { Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true }); Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true }); } catch (e) { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; } }
  }, { deny, speech });
}
export async function fresh(page) { await page.goto('./'); await page.evaluate(() => localStorage.clear()); await page.goto('about:blank'); }
