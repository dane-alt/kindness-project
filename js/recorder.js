// Voice answers: MediaRecorder for audio (webm/opus on Android, mp4/aac on iOS Safari),
// Web Speech API for live transcription where the browser has it. Typing always works.
export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus'];
  return opts.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
}
export const canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined');
export const canTranscribe = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export class Recorder {
  constructor({ onTranscript, onState }) { this.onTranscript = onTranscript; this.onState = onState; this.blob = null; }
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMime();
    this.mr = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.mr.ondataavailable = e => e.data && e.data.size && this.chunks.push(e.data);
    this.done = new Promise(res => { this.mr.onstop = () => { this.blob = new Blob(this.chunks, { type: this.mr.mimeType || mime || 'audio/mp4' }); res(this.blob); }; });
    this.mr.start(1000);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR && this.onTranscript) {
      try {
        this.sr = new SR(); this.sr.continuous = true; this.sr.interimResults = true; this.sr.lang = navigator.language || 'en-US';
        let finalText = '';
        this.sr.onresult = ev => {
          let interim = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const t = ev.results[i][0].transcript;
            if (ev.results[i].isFinal) finalText += t + ' '; else interim += t;
          }
          this.onTranscript && this.onTranscript((finalText + interim).trim());
        };
        this.sr.onerror = () => {}; this.sr.start();
      } catch { this.sr = null; }
    }
    this.onState && this.onState('recording');
  }
  async stop() {
    try { this.sr && this.sr.stop(); } catch {}
    if (this.mr && this.mr.state !== 'inactive') this.mr.stop();
    this.stream && this.stream.getTracks().forEach(t => t.stop());
    const b = await this.done; this.onState && this.onState('stopped'); return b;
  }
}
