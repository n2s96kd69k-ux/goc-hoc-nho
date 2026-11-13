// ===== Hiệu ứng phần thưởng: xu bay, sparkle, confetti nhẹ, popup Pomodoro =====
import { h } from '../utils.js';
import { openModal } from './modal.js';
import { mascotSVG } from '../mascot.js';

/** Hiện "+N xu" bay lên từ element; với số dương thêm một đồng xu bay về coin counter */
export function floatCoins(amount, fromEl) {
  const root = document.getElementById('reward-root');
  const rect = fromEl ? fromEl.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const sx = rect.left + rect.width / 2, sy = rect.top;
  const el = h(`<div class="coin-float ${amount < 0 ? 'neg' : ''}">${amount > 0 ? '+' : ''}${amount} 🪙</div>`);
  el.style.left = `${sx}px`; el.style.top = `${sy}px`;
  root.appendChild(el);
  setTimeout(() => el.remove(), 1200);
  const coinEl = document.querySelector('.header-coins');
  if (amount > 0 && coinEl && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const tr = coinEl.getBoundingClientRect();
    const coin = h('<span class="coin-fly">🪙</span>');
    coin.style.left = `${sx}px`; coin.style.top = `${sy}px`;
    coin.style.setProperty('--tx', `${tr.left + tr.width / 2 - sx}px`);
    coin.style.setProperty('--ty', `${tr.top + tr.height / 2 - sy}px`);
    root.appendChild(coin);
    setTimeout(() => { coin.remove(); coinEl.classList.remove('bump'); void coinEl.offsetWidth; coinEl.classList.add('bump'); }, 620);
  } else if (coinEl) { coinEl.classList.remove('bump'); void coinEl.offsetWidth; coinEl.classList.add('bump'); }
}

/** Sparkle nhỏ tại element */
export function sparkleAt(el, count = 6) {
  if (!el) return;
  const root = document.getElementById('reward-root');
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const glyphs = ['✨', '⭐', '💛', '🌷'];
  for (let i = 0; i < count; i++) {
    const s = h(`<span class="sparkle">${glyphs[i % glyphs.length]}</span>`);
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 30 + Math.random() * 30;
    s.style.left = `${cx}px`; s.style.top = `${cy}px`;
    s.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(ang) * dist - 20}px`);
    root.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

/** Confetti rất nhẹ toàn màn hình */
export function confetti(count = 24) {
  const root = document.getElementById('reward-root');
  const colors = ['#F4C8C5', '#F3D993', '#BFD8B8', '#C8DDEE', '#D8CEE8'];
  for (let i = 0; i < count; i++) {
    const c = h('<span class="confetti"></span>');
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.4}s`;
    c.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    root.appendChild(c);
    setTimeout(() => c.remove(), 2600);
  }
}

/** Popup hoàn thành Pomodoro */
export function pomodoroCompletePopup(minutes, coins = 25) {
  confetti(20);
  const m = openModal({
    title: '',
    size: 'sm',
    hideClose: true,
    content: `
      <div class="reward-popup">
        <div class="reward-mascot">${mascotSVG(110, { state: 'celebrate' })}</div>
        <h2 class="reward-title">✨ Hoàn thành!</h2>
        <p class="reward-sub">Bạn vừa tập trung ${minutes} phút.</p>
        <ul class="reward-list">
          <li>🪙 +${coins} xu</li>
          <li>🍅 +1 Pomodoro</li>
          <li>⏱ +${minutes} phút học</li>
        </ul>
        <button class="btn btn-primary btn-lg" type="button" data-act="ok">Tuyệt!</button>
      </div>`,
  });
  m.el.classList.add('celebrate');
  m.body.querySelector('[data-act="ok"]').onclick = () => m.close();
}

/** Popup mở khóa vật phẩm */
export function itemUnlockedPopup(item) {
  const m = openModal({
    size: 'sm',
    hideClose: true,
    content: `
      <div class="reward-popup">
        <div class="unlock-item">${item.emoji}</div>
        <h2 class="reward-title">Một món nhỏ dành cho mình 🎁</h2>
        <p class="reward-sub"><strong>${item.name}</strong> đã xuất hiện trong góc học của bạn.</p>
        <button class="btn btn-primary btn-lg" type="button" data-act="ok">Dễ thương quá!</button>
      </div>`,
  });
  m.body.querySelector('[data-act="ok"]').onclick = () => m.close();
  sparkleAt(m.body.querySelector('.unlock-item'), 8);
}

/** Popup mốc chuỗi */
export function streakPopup(milestone, coins) {
  confetti(30);
  const m = openModal({
    size: 'sm', hideClose: true,
    content: `
      <div class="reward-popup">
        <div class="unlock-item">🔥</div>
        <h2 class="reward-title">Chuỗi ${milestone} ngày cố gắng!</h2>
        <p class="reward-sub">Bạn kiên trì thật đấy. Nhận <strong>+${coins} xu</strong> nhé 🌷</p>
        <button class="btn btn-primary btn-lg" type="button" data-act="ok">Cảm ơn Mochi!</button>
      </div>`,
  });
  m.body.querySelector('[data-act="ok"]').onclick = () => m.close();
}
