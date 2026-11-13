// ===== Trang /pomodoro =====
import { getState } from '../state.js';
import { mmss, todayKey, escapeHtml, minutesToText } from '../utils.js';
import { getTimer, onTimer, start, pause, reset, setPreset, setMode, attachTask } from '../timer.js';
import { tasksOfDay, getTask } from '../tasks.js';
import { getSubject } from '../subjects.js';
import { mascotSVG, mascot } from '../mascot.js';
import { pomodorosOfDay, minutesOfDay } from '../statistics.js';
import { openModal } from '../components/modal.js';

let unsub = null;

export function renderPomodoro(root) {
  if (unsub) { unsub(); unsub = null; }
  const s = getState();
  const tm = getTimer();
  const t = todayKey();
  const todo = tasksOfDay(t).filter((x) => !x.done);
  const presets = [[25, 5], [50, 10]];
  const isPreset = presets.some(([f, b]) => f === s.settings.focusMinutes && b === s.settings.breakMinutes);

  root.innerHTML = `
    <section class="page pomodoro-page">
      <h1 class="page-title">🍅 THỜI GIAN TẬP TRUNG</h1>
      <p class="page-sub">Chọn một việc, đặt giờ, rồi mình cùng học nhé.</p>

      <div class="pomo-layout">
        <div class="pomo-card paper">
          <div class="pomo-modes">
            <button type="button" class="chip ${tm.mode === 'focus' ? 'active' : ''}" data-mode="focus">Tập trung</button>
            <button type="button" class="chip ${tm.mode === 'break' ? 'active' : ''}" data-mode="break">Nghỉ ngơi</button>
          </div>
          <div class="pomo-ring">
            <svg viewBox="0 0 200 200" width="240" height="240">
              <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(111,85,71,.1)" stroke-width="12"/>
              <circle id="pomo-arc" cx="100" cy="100" r="88" fill="none" stroke="var(--peach-dark)" stroke-width="12" stroke-linecap="round"
                stroke-dasharray="552.9" stroke-dashoffset="0" transform="rotate(-90 100 100)"/>
            </svg>
            <div class="pomo-time" id="pomo-time">${mmss(tm.remaining)}</div>
            <div class="pomo-state" id="pomo-state"></div>
          </div>
          <div class="pomo-controls">
            <button type="button" class="btn btn-primary btn-lg" id="pomo-start">▶ BẮT ĐẦU TẬP TRUNG</button>
            <button type="button" class="btn btn-ghost" id="pomo-pause">⏸ TẠM DỪNG</button>
            <button type="button" class="btn btn-ghost" id="pomo-reset">↻ ĐẶT LẠI</button>
          </div>
          <div class="pomo-presets">
            ${presets.map(([f, b]) => `<button type="button" class="chip ${s.settings.focusMinutes === f && s.settings.breakMinutes === b ? 'active' : ''}" data-preset="${f},${b}">${f} / ${b}</button>`).join('')}
            <button type="button" class="chip ${isPreset ? '' : 'active'}" id="pomo-custom">Tùy chỉnh${isPreset ? '' : ` (${s.settings.focusMinutes}/${s.settings.breakMinutes})`}</button>
          </div>
        </div>

        <aside class="pomo-side">
          <div class="paper pomo-mascot-box">
            <div class="mascot-wrap mascot-${mascot.state}" id="pomo-mascot">${mascotSVG(120)}</div>
            <p class="mascot-bubble" id="pomo-msg">${tm.status === 'running' ? 'Shh… đang tập trung 🎧' : 'Sẵn sàng chưa? Mình canh giờ cho bạn.'}</p>
          </div>
          <div class="paper">
            <h4 class="side-title">📌 Đang làm gì?</h4>
            <select id="pomo-task" class="select">
              <option value="">— Không gắn nhiệm vụ —</option>
              ${todo.map((x) => `<option value="${x.id}" ${tm.taskId === x.id ? 'selected' : ''}>${escapeHtml(x.title)}</option>`).join('')}
            </select>
            <div class="pomo-today">
              <span>🍅 Hôm nay: <strong>${pomodorosOfDay(t)}</strong></span>
              <span>⏱ <strong>${minutesToText(minutesOfDay(t))}</strong></span>
            </div>
          </div>
        </aside>
      </div>
    </section>`;

  const arc = root.querySelector('#pomo-arc');
  const timeEl = root.querySelector('#pomo-time');
  const stateEl = root.querySelector('#pomo-state');
  const startBtn = root.querySelector('#pomo-start');
  const pauseBtn = root.querySelector('#pomo-pause');
  const C = 552.9;

  const paint = () => {
    const tmr = getTimer();
    timeEl.textContent = mmss(tmr.remaining);
    arc.style.strokeDashoffset = (C - (C * tmr.remaining) / Math.max(1, tmr.duration)).toFixed(1);
    arc.style.stroke = tmr.mode === 'focus' ? 'var(--peach-dark)' : 'var(--sky-dark)';
    stateEl.textContent = tmr.status === 'running' ? (tmr.mode === 'focus' ? 'Đang tập trung…' : 'Đang nghỉ ☕')
      : tmr.status === 'paused' ? 'Tạm dừng' : (tmr.mode === 'focus' ? 'Tập trung' : 'Nghỉ ngơi');
    startBtn.textContent = tmr.status === 'running' ? '▶ ĐANG CHẠY' : tmr.status === 'paused' ? '▶ TIẾP TỤC' : (tmr.mode === 'focus' ? '▶ BẮT ĐẦU TẬP TRUNG' : '▶ BẮT ĐẦU NGHỈ');
    startBtn.disabled = tmr.status === 'running';
    pauseBtn.disabled = tmr.status !== 'running';
    root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === tmr.mode));
    const m = root.querySelector('#pomo-mascot');
    if (m) m.className = `mascot-wrap mascot-${mascot.state}`;
  };
  paint();
  unsub = onTimer(paint);

  startBtn.onclick = () => { start(); paint(); root.querySelector('#pomo-msg').textContent = getTimer().mode === 'focus' ? 'Shh… đang tập trung 🎧' : 'Nghỉ chút thôi rồi quay lại nhé ☕'; };
  pauseBtn.onclick = () => { pause(); paint(); root.querySelector('#pomo-msg').textContent = 'Tạm nghỉ một chút cũng được.'; };
  root.querySelector('#pomo-reset').onclick = () => { reset(); paint(); };
  root.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { setMode(b.dataset.mode); paint(); });
  root.querySelectorAll('[data-preset]').forEach((b) => b.onclick = () => {
    const [f, br] = b.dataset.preset.split(',').map(Number);
    setPreset(f, br);
    renderPomodoro(root);
  });
  root.querySelector('#pomo-custom').onclick = () => openCustom(root);
  root.querySelector('#pomo-task').onchange = (e) => {
    const task = getTask(e.target.value);
    attachTask(task ? task.id : null, task ? task.subjectId : null);
  };
}

function openCustom(root) {
  const s = getState().settings;
  const m = openModal({
    title: '⏱ Tùy chỉnh thời gian', size: 'sm',
    content: `
      <form id="custom-form" class="task-form">
        <div class="field-row">
          <label class="field"><span>Tập trung (phút)</span><input type="number" name="focus" min="1" max="180" value="${s.focusMinutes}"></label>
          <label class="field"><span>Nghỉ (phút)</span><input type="number" name="break" min="1" max="60" value="${s.breakMinutes}"></label>
        </div>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-act="cancel">Hủy</button><button class="btn btn-primary" type="submit">Áp dụng</button></div>
      </form>`,
  });
  const f = m.body.querySelector('#custom-form');
  f.onsubmit = (e) => { e.preventDefault(); setPreset(Number(f.focus.value) || 25, Number(f.break.value) || 5); m.close(); renderPomodoro(root); };
  m.body.querySelector('[data-act="cancel"]').onclick = () => m.close();
}
