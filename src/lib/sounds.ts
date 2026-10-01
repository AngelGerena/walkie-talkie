// Radio tones generated with Web Audio, so there are no files to load.
type Ctx = AudioContext;
let ctx: Ctx | null = null;

function ac(): Ctx | null {
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.07) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime + start;
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

export const sounds = {
  /** Call from a tap so iOS allows audio later. */
  unlock() {
    const c = ac();
    if (c) tone(20, 0, 0.01, 'sine', 0.0002);
  },
  chirp() {
    tone(1750, 0, 0.06);
  },
  incoming() {
    tone(1150, 0, 0.05, 'sine', 0.06);
  },
  roger() {
    tone(1400, 0, 0.08);
    tone(1000, 0.1, 0.1);
  },
  busy() {
    tone(420, 0, 0.12);
    tone(420, 0.18, 0.12);
    tone(420, 0.36, 0.12);
  },
  alarm() {
    for (let i = 0; i < 6; i++) {
      tone(880, i * 0.5, 0.24, 'sawtooth', 0.12);
      tone(640, i * 0.5 + 0.25, 0.24, 'sawtooth', 0.12);
    }
  },
};
