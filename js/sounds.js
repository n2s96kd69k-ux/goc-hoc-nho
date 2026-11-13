// ===== Âm thanh rất nhẹ bằng Web Audio (không cần file ngoài) =====
import { getState } from './state.js';

let ctx = null;
let unlocked = false;
// Chỉ tạo AudioContext sau khi người dùng đã tương tác (tránh cảnh báo autoplay)
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => { unlocked = true; }, { once: true, passive: true }));

function audio() {
  if (!unlocked) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq = 600, dur = 0.12, type = 'sine', gain = 0.08, slide = 0, delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  const t0 = ac.currentTime + delay;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function enabled() {
  const s = getState();
  return s && s.settings && s.settings.sound !== false;
}

export const sounds = {
  /** Tick task: "pop" */
  pop() {
    if (!enabled()) return;
    tone({ freq: 520, dur: 0.09, type: 'triangle', gain: 0.07, slide: 260 });
  },
  /** Hoàn thành Pomodoro: "ting" */
  ting() {
    if (!enabled()) return;
    tone({ freq: 1046, dur: 0.35, gain: 0.06 });
    tone({ freq: 1568, dur: 0.45, gain: 0.05, delay: 0.12 });
  },
  /** Nhận vật phẩm: "plop" */
  plop() {
    if (!enabled()) return;
    tone({ freq: 320, dur: 0.14, type: 'sine', gain: 0.08, slide: -140 });
    tone({ freq: 660, dur: 0.1, type: 'triangle', gain: 0.04, delay: 0.1 });
  },
  /** Nhận xu: chuỗi nhỏ */
  coin() {
    if (!enabled()) return;
    tone({ freq: 880, dur: 0.08, gain: 0.05 });
    tone({ freq: 1320, dur: 0.12, gain: 0.05, delay: 0.07 });
  },
  /** Hoàn thành cả ngày */
  fanfare() {
    if (!enabled()) return;
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.18, gain: 0.05, delay: i * 0.09 }));
  },
};
