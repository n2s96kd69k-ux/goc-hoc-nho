// ===== Linh vật: mèo kem Mochi — digital companion (SVG + CSS animation) =====
// Trạng thái nền:  idle | study | focus | sleepy | rest | night | walk
// Phản ứng tạm:    happy | celebrate | interact-* (look-left, look-right, wave, blink, wiggle)
import { getState } from './state.js';

const listeners = new Set();
let current = 'idle';
let reactTimeout = null;
let lastClick = 0;
let clickIdx = 0;

const REACTIONS = ['look-left', 'look-right', 'wave', 'blink', 'wiggle', 'happy'];

export const mascot = {
  get state() { return current; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** Đặt trạng thái nền (bền) */
  setState(s) {
    if (current === s) return;
    current = s;
    clearTimeout(reactTimeout);
    for (const fn of listeners) fn(current, false);
  },
  /** Phản ứng tạm thời rồi trở về trạng thái nền */
  react(s, ms = 1700) {
    const base = current;
    clearTimeout(reactTimeout);
    for (const fn of listeners) fn(s, true);
    reactTimeout = setTimeout(() => { for (const fn of listeners) fn(base, false); }, ms);
  },
  /** Click vào mèo: phản ứng khác nhau mỗi lần, có cooldown 700ms */
  poke() {
    const now = Date.now();
    if (now - lastClick < 700) return null;
    lastClick = now;
    // không lặp lại phản ứng ngay trước đó
    let next = Math.floor(Math.random() * REACTIONS.length);
    if (next === clickIdx) next = (next + 1) % REACTIONS.length;
    clickIdx = next;
    const r = REACTIONS[next];
    this.react(r === 'happy' ? 'happy' : 'interact-' + r, r === 'happy' ? 1700 : 1100);
    return r;
  },
};

// Phụ kiện đeo (đọc theo id item trong items.js)
const ACCESSORY_SVG = {
  headphone: `<g class="acc acc-headphone">
      <path d="M22 44 Q50 8 78 44" fill="none" stroke="#7A6A80" stroke-width="5" stroke-linecap="round"/>
      <rect x="14" y="40" width="14" height="20" rx="6" fill="#B9A7CF"/>
      <rect x="72" y="40" width="14" height="20" rx="6" fill="#B9A7CF"/>
    </g>`,
  bow: `<g class="acc acc-bow" transform="translate(66,30) rotate(-15)">
      <ellipse cx="-8" cy="0" rx="8" ry="5" fill="#F4A9B8"/><ellipse cx="8" cy="0" rx="8" ry="5" fill="#F4A9B8"/>
      <circle cx="0" cy="0" r="3.5" fill="#E8899E"/>
    </g>`,
  crown: `<g class="acc acc-crown">
      <path d="M36 28 L42 16 L50 26 L58 16 L64 28 Z" fill="#F3D993" stroke="#E2C15A" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="42" cy="16" r="2" fill="#F4A9B8"/><circle cx="58" cy="16" r="2" fill="#A9C7E8"/>
    </g>`,
  glasses: `<g class="acc acc-glasses" fill="none" stroke="#7A6A80" stroke-width="2.5">
      <circle cx="40" cy="58" r="8"/><circle cx="60" cy="58" r="8"/><path d="M48 58 h4"/>
    </g>`,
};

/**
 * SVG mascot.
 * opts.accessory: ghi đè phụ kiện; opts.seed: số để tạo randomness cho chu kỳ animation.
 */
export function mascotSVG(size = 120, opts = {}) {
  const s = getState();
  const acc = opts.accessory !== undefined ? opts.accessory : (s && s.mascot.accessory);
  const accSvg = acc && ACCESSORY_SVG[acc] ? ACCESSORY_SVG[acc] : '';
  const seed = opts.seed ?? Math.random();
  // randomness: mỗi instance có chu kỳ chớp mắt / đuôi hơi khác nhau
  const style = `--blink:${(3.8 + seed * 2.4).toFixed(2)}s;--tail:${(2.6 + seed * 1.4).toFixed(2)}s;--sway:${(3.6 + seed * 1.2).toFixed(2)}s;--delay:${(-seed * 3).toFixed(2)}s`;
  return `
  <svg class="mascot-svg" style="${style}" viewBox="0 0 100 110" width="${size}" height="${size * 1.1}" role="img" aria-label="Mèo Mochi">
    <g class="m-body-group">
      <path class="m-tail" d="M72 88 Q95 82 88 66" fill="none" stroke="#EAD8BE" stroke-width="8" stroke-linecap="round"/>
      <ellipse class="m-body" cx="50" cy="86" rx="26" ry="18" fill="#F6E7CF"/>
      <ellipse cx="36" cy="100" rx="9" ry="5" fill="#F0DCC0"/>
      <ellipse cx="64" cy="100" rx="9" ry="5" fill="#F0DCC0"/>
      <!-- tay -->
      <g class="m-arm m-arm-l"><ellipse cx="30" cy="84" rx="6" ry="9" fill="#F3E2C8"/></g>
      <g class="m-arm m-arm-r"><ellipse cx="70" cy="84" rx="6" ry="9" fill="#F3E2C8"/></g>
      <g class="m-head">
        <path class="m-ear m-ear-l" d="M24 40 L28 18 L42 34 Z" fill="#F6E7CF"/>
        <path class="m-ear m-ear-r" d="M76 40 L72 18 L58 34 Z" fill="#F6E7CF"/>
        <path d="M28 38 L30 26 L38 34 Z" fill="#F4C8C5"/>
        <path d="M72 38 L70 26 L62 34 Z" fill="#F4C8C5"/>
        <ellipse cx="50" cy="56" rx="30" ry="26" fill="#F6E7CF"/>
        <ellipse class="m-blush" cx="32" cy="64" rx="5" ry="3" fill="#F4C8C5" opacity=".8"/>
        <ellipse class="m-blush" cx="68" cy="64" rx="5" ry="3" fill="#F4C8C5" opacity=".8"/>
        <g class="m-eyes">
          <g class="m-pupils">
            <ellipse class="m-eye" cx="40" cy="56" rx="3.2" ry="4.2" fill="#4F3C34"/>
            <ellipse class="m-eye" cx="60" cy="56" rx="3.2" ry="4.2" fill="#4F3C34"/>
            <circle cx="41" cy="54.5" r="1" fill="#fff"/><circle cx="61" cy="54.5" r="1" fill="#fff"/>
          </g>
        </g>
        <g class="m-eyes-closed">
          <path d="M36 57 q4 3 8 0" fill="none" stroke="#4F3C34" stroke-width="2" stroke-linecap="round"/>
          <path d="M56 57 q4 3 8 0" fill="none" stroke="#4F3C34" stroke-width="2" stroke-linecap="round"/>
        </g>
        <g class="m-eyes-half">
          <path d="M36 56 q4 -2 8 0" fill="none" stroke="#4F3C34" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M56 56 q4 -2 8 0" fill="none" stroke="#4F3C34" stroke-width="2.4" stroke-linecap="round"/>
        </g>
        <path d="M48 63 L52 63 L50 66 Z" fill="#E8A5A0"/>
        <path class="m-mouth" d="M46 68 q4 3 8 0" fill="none" stroke="#6F5547" stroke-width="1.6" stroke-linecap="round"/>
        <path class="m-mouth-open" d="M45 68 q5 7 10 0 z" fill="#E8899E"/>
        <path class="m-yawn" d="M45 66 q5 10 10 0 z" fill="#E8899E"/>
        <g stroke="#C9B8A3" stroke-width="1.2" stroke-linecap="round">
          <path d="M18 60 h10"/><path d="M18 66 h10"/><path d="M72 60 h10"/><path d="M72 66 h10"/>
        </g>
        ${accSvg}
        <g class="m-auto-headphone">
          <path d="M22 44 Q50 8 78 44" fill="none" stroke="#7A6A80" stroke-width="5" stroke-linecap="round"/>
          <rect x="14" y="40" width="14" height="20" rx="6" fill="#B9A7CF"/><rect x="72" y="40" width="14" height="20" rx="6" fill="#B9A7CF"/>
        </g>
      </g>
      <!-- sách -->
      <g class="m-book">
        <path d="M30 92 L50 96 L70 92 L70 104 L50 108 L30 104 Z" fill="#C8DDEE"/>
        <path d="M50 96 V108" stroke="#fff" stroke-width="1.5"/>
        <path d="M34 96 L46 98.5 M34 99 L46 101.5 M54 98.5 L66 96 M54 101.5 L66 99" stroke="#fff" stroke-width="1.2"/>
      </g>
      <!-- laptop -->
      <g class="m-laptop">
        <rect x="32" y="82" width="36" height="22" rx="3" fill="#7A6A80"/>
        <rect class="m-screen" x="35" y="85" width="30" height="15" rx="2" fill="#C8DDEE"/>
        <rect x="28" y="103" width="44" height="4" rx="2" fill="#9A8AA0"/>
      </g>
      <!-- bút -->
      <g class="m-pen"><path d="M68 78 L76 66" stroke="#E3A29E" stroke-width="3" stroke-linecap="round"/></g>
    </g>
    <g class="m-zzz" font-family="Quicksand, sans-serif" font-weight="700" fill="#A8B8D8">
      <text x="78" y="30" font-size="10">z</text><text x="86" y="20" font-size="8">z</text>
    </g>
    <g class="m-hearts" fill="#F4A9B8">
      <path class="m-heart h1" d="M20 30 c-3-5 3-8 5-4 c2-4 8-1 5 4 l-5 5 z"/>
      <path class="m-heart h2" d="M76 26 c-3-5 3-8 5-4 c2-4 8-1 5 4 l-5 5 z"/>
      <path class="m-heart h3" d="M50 10 c-3-5 3-8 5-4 c2-4 8-1 5 4 l-5 5 z"/>
    </g>
    <g class="m-sparkles" fill="#F3D993">
      <path class="m-spark s1" d="M18 20 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/>
      <path class="m-spark s2" d="M82 14 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z"/>
    </g>
  </svg>`;
}

/** Lời nhắn theo trạng thái + thời gian */
export function mascotMessage(state, ctx = {}) {
  const hour = new Date().getHours();
  const name = ctx.userName || 'bạn';
  const lines = {
    idle: [
      hour < 11 ? `Chào buổi sáng, ${name} 🌷` : hour < 18 ? 'Cố thêm một chút nhé!' : 'Tối nay học nhẹ thôi cũng được 🌙',
      'Hôm nay mình làm gì trước nhỉ?',
      'Từng bước nhỏ thôi, mình ở đây rồi.',
    ],
    study: ['Đang học đây… tập trung nào!', 'Bài này hay quá.'],
    focus: ['Shh… đang tập trung 🎧', 'Mình canh giờ cho bạn nhé.'],
    sleepy: ['Ngáp… mắt hơi buồn ngủ rồi.', 'Nghỉ một chút… ☕'],
    rest: ['Sofa êm quá…', 'Nghỉ ngơi một chút rồi học tiếp nhé.'],
    night: ['Khuya rồi, học xong ngủ sớm nha 🌙', 'Đèn bàn ấm thật.'],
    walk: ['Đi dạo quanh phòng chút…'],
    happy: ['Xong một việc rồi ✨', 'Giỏi quá đi!'],
    celebrate: ['Hôm nay giỏi lắm 🌷', 'Tuyệt vời! Mình nhảy mừng luôn!'],
  };
  const key = state.startsWith('interact') ? 'happy' : state;
  const arr = lines[key] || lines.idle;
  if (ctx.stable) return arr[0];
  return arr[Math.floor(Math.random() * arr.length)];
}
