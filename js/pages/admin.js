import { listAnnouncements, publishAnnouncement, deleteAnnouncement } from '../admin/announcements.js';
import { requireAdmin, getCurrentUser, getAccountAccess } from '../cloud.js';
import { navigate, currentRoute } from '../router.js';
import { escapeHtml as esc } from '../utils.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { listUsers, resolveUser, changeUser, listActivity, adminError } from '../admin/service.js';
import { canChangeAccess, validateReason, coinChange } from '../admin/policy.js';

const tabs = { users: 'Người dùng', coins: 'Phát xu', announcements: 'Thông báo', activity: 'Nhật ký' };
const typeNames = { 'coins-add': 'Cộng xu', 'coins-set': 'Sửa số dư', role: 'Đổi quyền', status: 'Khóa / mở khóa' };
let generation = 0;
let activeModal = null;
export function disposeAdmin() { generation++; activeModal?.close(); activeModal = null; }
const money = value => new Intl.NumberFormat('vi-VN').format(value || 0);
function dateLabel(value) {
  const date = value?.toDate?.();
  return date ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date) : 'Đang ghi nhận';
}
export async function renderAdmin(root, params = {}) {
  activeModal?.close(); activeModal = null;
  const run = ++generation;
  root.innerHTML = '<section class="admin-loading" role="status">Đang kiểm tra quyền quản trị…</section>';
  const user = await requireAdmin();
  if (run !== generation || currentRoute()?.path !== '/admin') return;
  if (!user) { root.replaceChildren(); navigate('/'); return; }
  const tab = Object.hasOwn(tabs, params.tab) ? params.tab : 'users';
  root.innerHTML = `
    <section class="admin-shell" aria-label="Quản lý hệ thống">
      <aside class="admin-nav">
        <div class="admin-brand"><span class="admin-brand-mark">G</span><div>GÓC HỌC NHỎ<small>QUẢN TRỊ HỆ THỐNG</small></div></div>
        <nav aria-label="Chức năng quản trị">${Object.entries(tabs).map(([id, label], index) => `<a href="#/admin?tab=${id}" ${tab === id ? 'aria-current="page"' : ''}><span>0${index + 1}</span>${label}</a>`).join('')}</nav>
        <div class="admin-nav-foot"><span class="admin-status-dot"></span> Quản trị viên<a href="#/">Trở về góc học ↗</a></div>
      </aside>
      <div class="admin-content">
        <header class="admin-page-head"><div><p class="admin-eyebrow">QUẢN LÝ / ${tabs[tab].toUpperCase()}</p><h1>${tabs[tab]}</h1><p>${tab === 'users' ? 'Tra cứu tài khoản, phân quyền và quản lý trạng thái truy cập.' : tab === 'coins' ? 'Phát xu sự kiện cho từng tài khoản, có xác nhận và lịch sử.' : tab === 'announcements' ? 'Soạn và phát thông báo chung cho Góc Học Nhỏ.' : 'Lịch sử các thay đổi quản trị đã được lưu trên máy chủ.'}</p></div><span class="admin-badge">${getAccountAccess().owner ? 'Chủ hệ thống' : 'Quản trị viên'}</span></header>
        <div class="admin-view" id="admin-view"></div>
      </div>
    </section>`;
  const view = root.querySelector('#admin-view');
  const alive = () => run === generation && currentRoute()?.path === '/admin';
  if (tab === 'users') usersView(view, alive);
  else if (tab === 'coins') coinsView(view, alive);
  else if (tab === 'announcements') announcementsView(view, alive);
  else activityView(view, alive);
}
function usersView(view, alive) {
  let rows = [], history = [null], page = 0, result = null, search = '', request = 0;
  view.innerHTML = `<section class="admin-panel"><form class="admin-toolbar" id="admin-search"><label class="admin-search"><span>Tìm tài khoản</span><input name="term" type="search" placeholder="UID, mã GHN-… hoặc email đầy đủ" maxlength="254"></label><button class="admin-button" type="submit">Tìm kiếm</button><button class="admin-button secondary" type="button" id="admin-refresh">Làm mới</button></form><p class="admin-caption">20 tài khoản mỗi trang. Tìm chính xác theo UID, mã tài khoản hoặc email đã được lưu.</p><div id="admin-table" aria-live="polite"></div><footer class="admin-pagination"><span id="admin-page-label"></span><div><button class="admin-button secondary" id="admin-prev" type="button">← Trước</button><button class="admin-button secondary" id="admin-next" type="button">Sau →</button></div></footer></section>`;
  const table = view.querySelector('#admin-table');
  const prev = view.querySelector('#admin-prev'), next = view.querySelector('#admin-next');
  async function load() {
    const ticket = ++request;
    prev.disabled = next.disabled = true;
    table.innerHTML = '<p class="admin-empty" role="status">Đang tải danh sách…</p>';
    try {
      const data = await listUsers({ cursor: history[page], search });
      if (!alive() || ticket !== request) return;
      result = data; rows = data.rows;
      view.querySelector('#admin-page-label').textContent = `Trang ${page + 1} · ${rows.length} tài khoản`;
      paint();
      prev.disabled = page === 0; next.disabled = !data.hasMore;
    } catch (e) { if (alive() && ticket === request) table.innerHTML = `<p class="admin-error" role="alert">${esc(adminError(e))}</p>`; }
  }
  function paint() {
    if (!rows.length) { table.innerHTML = '<p class="admin-empty">Không tìm thấy tài khoản. Người học cần đăng nhập để có hồ sơ trên hệ thống.</p>'; return; }
    table.innerHTML = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th scope="col">Người dùng</th><th scope="col">Email / UID</th><th scope="col">Số xu</th><th scope="col">Quyền</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead><tbody>${rows.map((row, i) => {
      const manageable = canChangeAccess(getCurrentUser()?.uid, row.uid, row);
      let photo = ''; try { if (new URL(row.photoURL).protocol === 'https:') photo = row.photoURL; } catch {}
      return `<tr><td><div class="admin-person"><span class="admin-avatar">${photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : esc(row.displayName.slice(0, 1).toUpperCase())}</span><div><strong>${esc(row.displayName)}</strong><small>${esc(row.publicId || 'Chưa có mã')}${row.owner ? ' · Chủ hệ thống' : ''}</small></div></div></td><td><div>${esc(row.email || 'Chưa cập nhật email')}</div><code>${esc(row.uid)}</code></td><td class="admin-number">${money(row.coins)}</td><td><span class="admin-badge ${row.role === 'admin' ? 'accent' : ''}">${row.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</span></td><td><span class="admin-badge ${row.status === 'banned' ? 'danger' : 'success'}">${row.status === 'banned' ? 'Đã khóa' : 'Hoạt động'}</span></td><td><div class="admin-row-actions"><button class="admin-button compact secondary" data-action="coins" data-index="${i}">Sửa xu</button><button class="admin-button compact secondary" data-action="role" data-index="${i}" ${manageable ? '' : 'disabled'}>Đổi quyền</button><button class="admin-button compact ${row.status === 'banned' ? 'secondary' : 'danger'}" data-action="status" data-index="${i}" ${manageable ? '' : 'disabled'}>${row.status === 'banned' ? 'Mở khóa' : 'Khóa'}</button></div></td></tr>`;
    }).join('')}</tbody></table></div>`;
    table.querySelectorAll('[data-action]').forEach(button => button.onclick = () => editDialog(rows[Number(button.dataset.index)], button.dataset.action, {}, load));
  }
  view.querySelector('#admin-search').onsubmit = e => { e.preventDefault(); search = e.target.term.value.trim(); history = [null]; page = 0; load(); };
  view.querySelector('#admin-refresh').onclick = () => load();
  prev.onclick = () => { if (page > 0) { page--; load(); } };
  next.onclick = () => { if (result?.hasMore) { history[++page] = result.cursor; load(); } };
  load();
}
function coinsView(view, alive) {
  view.innerHTML = `<section class="admin-panel admin-form-panel"><h2>Phát xu sự kiện</h2><p class="admin-caption">Kiểm tra đúng người nhận trước khi xác nhận. Mỗi giao dịch được ghi vào nhật ký.</p><form id="admin-grant" class="admin-form"><label>Email, UID hoặc mã tài khoản<input name="target" required maxlength="254" placeholder="Ví dụ: hoc-sinh@email.com" autocomplete="off"></label><label>Số xu muốn cộng<input name="amount" type="number" min="1" max="1000000" step="1" required placeholder="100"></label><label>Lý do / tên sự kiện<textarea name="reason" required minlength="3" maxlength="300" rows="3" placeholder="Thưởng thử thách học tập tuần này"></textarea></label><p class="admin-error" id="admin-grant-error" role="alert"></p><button class="admin-button" type="submit">Kiểm tra người nhận →</button></form></section>`;
  const form = view.querySelector('form');
  form.onsubmit = async e => {
    e.preventDefault(); const button = form.querySelector('button'); const error = view.querySelector('#admin-grant-error');
    error.textContent = ''; button.disabled = true;
    try {
      const amount = Number(form.amount.value); coinChange(0, amount, 'add'); const reason = validateReason(form.reason.value);
      const row = await resolveUser(form.target.value);
      if (alive()) editDialog(row, 'coins', { mode: 'add', amount, reason }, () => { if (alive()) { form.reset(); form.target.focus(); } });
    } catch (e) { if (alive()) error.textContent = adminError(e); }
    finally { if (alive()) button.disabled = false; }
  };
}
function editDialog(row, action, initial = {}, onSaved) {
  const coins = action === 'coins'; const role = action === 'role';
  const title = coins ? 'Điều chỉnh xu' : role ? 'Thay đổi quyền' : row.status === 'banned' ? 'Mở khóa tài khoản' : 'Khóa tài khoản';
  const m = openModal({ title, size: 'md', content: `<form class="admin-form" id="admin-change"><div class="admin-target"><strong>${esc(row.displayName)}</strong><span>${esc(row.email || row.publicId)}</span><code>${esc(row.uid)}</code></div>${coins ? `<p>Số dư hiện tại: <strong>${money(row.coins)} xu</strong></p><label>Thao tác<select name="mode"><option value="set" ${initial.mode !== 'add' ? 'selected' : ''}>Đặt số dư mới</option><option value="add" ${initial.mode === 'add' ? 'selected' : ''}>Cộng thêm xu</option></select></label><label>Số xu<input name="amount" type="number" min="0" max="1000000" step="1" value="${initial.amount ?? row.coins}" required></label>` : role ? `<label>Quyền mới<select name="role"><option value="member" ${row.role === 'member' ? 'selected' : ''}>Thành viên</option><option value="admin" ${row.role === 'admin' ? 'selected' : ''}>Quản trị viên</option></select></label>` : `<p>${row.status === 'banned' ? 'Cho phép tài khoản truy cập dữ liệu trở lại.' : 'Tài khoản sẽ bị chặn truy cập dữ liệu học tập trên máy chủ.'}</p>`}<label>Lý do<textarea name="reason" rows="3" required minlength="3" maxlength="300">${esc(initial.reason || '')}</textarea></label><p class="admin-error" role="alert" id="admin-change-error"></p><p class="admin-caption" id="admin-pending-note" hidden>Nếu mất kết nối, hãy thử lại cùng yêu cầu để tránh ghi nhận hai lần.</p><div class="admin-dialog-actions"><button type="button" class="admin-button secondary" id="admin-cancel">Hủy</button><button type="submit" class="admin-button">Xác nhận</button></div></form>` });
  activeModal = m;
  const form = m.body.querySelector('form'), button = form.querySelector('[type="submit"]');
  const operationId = crypto.randomUUID(); let pending = null;
  form.querySelector('#admin-cancel').onclick = () => { m.close(); activeModal = null; };
  form.onsubmit = async e => {
    e.preventDefault(); const error = form.querySelector('#admin-change-error'); error.textContent = '';
    try {
      if (!pending) {
        const reason = validateReason(form.reason.value);
        const type = coins ? (form.mode.value === 'add' ? 'coins-add' : 'coins-set') : action;
        const value = coins ? Number(form.amount.value) : role ? form.role.value : row.status === 'banned' ? 'active' : 'banned';
        if (coins) coinChange(row.coins, value, form.mode.value);
        pending = { uid: row.uid, type, value, reason, operationId };
        form.querySelectorAll('input,select,textarea').forEach(el => { el.disabled = true; });
      }
      button.disabled = true; button.textContent = 'Đang lưu…';
      await changeUser(pending);
      if (currentRoute()?.path !== '/admin') return;
      m.close(); activeModal = null; toast('Đã lưu thay đổi và nhật ký.'); onSaved?.();
    } catch (e) {
      error.textContent = adminError(e); button.disabled = false; button.textContent = pending ? 'Thử lại yêu cầu' : 'Xác nhận';
      form.querySelector('#admin-pending-note').hidden = !pending;
    }
  };
}
async function activityView(view, alive) {
  view.innerHTML = '<section class="admin-panel"><p class="admin-empty" role="status">Đang tải nhật ký…</p></section>';
  try {
    const rows = await listActivity(); if (!alive()) return;
    view.innerHTML = `<section class="admin-panel"><div class="admin-panel-head"><h2>Thao tác gần đây</h2><button class="admin-button secondary" id="admin-log-refresh">Làm mới</button></div><p class="admin-caption">30 thao tác mới nhất · Giờ Việt Nam</p>${rows.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Thời gian</th><th>Thao tác</th><th>Người thực hiện</th><th>Tài khoản nhận</th><th>Trước → Sau</th><th>Lý do</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(dateLabel(row.createdAt))}</td><td>${esc(typeNames[row.type] || row.type)}</td><td>${esc(row.actorEmail || row.actorUid)}</td><td><code>${esc(row.targetUid)}</code></td><td>${esc(row.before)} → ${esc(row.after)}</td><td>${esc(row.reason)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="admin-empty">Chưa có thao tác quản trị nào.</p>'}</section>`;
    view.querySelector('#admin-log-refresh').onclick = () => activityView(view, alive);
  } catch (e) { if (alive()) view.innerHTML = `<p class="admin-error" role="alert">${esc(adminError(e))}</p>`; }
}

function announcementsView(view, alive) {
  let pending = null, request = 0;
  view.innerHTML = `<section class="admin-panel admin-form-panel"><h2>Gửi một lời nhắn đến mọi người</h2><p class="admin-caption">Thông báo xuất hiện trên banner và trong chuông của tất cả người học. Mỗi lần phát là một thông báo mới.</p><form class="admin-form" id="announcement-form"><label>Nội dung thông báo<textarea name="content" rows="4" required maxlength="1000" placeholder="Ví dụ: Cuối tuần này cùng hoàn thành mục tiêu học tập nhé!"></textarea></label><p class="admin-error" role="alert" id="announcement-error"></p><button class="admin-button" type="submit">Phát thông báo cho mọi người</button></form></section><section class="admin-panel" style="margin-top:20px"><div class="admin-panel-head"><h2>Thông báo đã phát</h2><button class="admin-button secondary" id="refresh-announcements">Làm mới</button></div><p class="admin-caption">30 thông báo gần nhất. Xóa sẽ ngừng phân phối; người đã nhận vẫn có thể xem bản lưu trong chuông.</p><div id="announcement-list" aria-live="polite"></div></section>`;
  const form = view.querySelector('form'), error = view.querySelector('#announcement-error');
  const list = view.querySelector('#announcement-list');
  async function load() {
    const ticket = ++request;
    list.innerHTML = '<p class="admin-empty">Đang tải thông báo…</p>';
    try {
      const rows = await listAnnouncements(); if (!alive() || ticket !== request) return;
      list.innerHTML = rows.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Ngày phát</th><th>Nội dung</th><th>Thao tác</th></tr></thead><tbody>${rows.map((r,i) => `<tr><td>${esc(dateLabel(r.createdAt))}</td><td style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(r.content)}</td><td><button class="admin-button compact danger" data-delete-announcement="${i}">Xóa</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="admin-empty">Chưa có thông báo nào. Bạn có thể soạn lời nhắn đầu tiên ở trên.</p>';
      list.querySelectorAll('[data-delete-announcement]').forEach(button => button.onclick = async () => {
        const row = rows[Number(button.dataset.deleteAnnouncement)];
        const ok = await confirmDialog({ title: 'Xóa thông báo?', message: 'Thông báo sẽ ngừng gửi đến người học mới. Bản đã nhận trong chuông vẫn được giữ.', okText: 'Xóa', danger: true });
        if (!ok || !alive()) return;
        button.disabled = true;
        try { await deleteAnnouncement(row.id); if (alive()) { toast('Đã xóa thông báo.'); load(); } }
        catch (e) { if (alive()) { error.textContent = adminError(e); button.disabled = false; } }
      });
    } catch (e) { if (alive() && ticket === request) list.innerHTML = `<p class="admin-error" role="alert">${esc(adminError(e))}</p>`; }
  }
  form.onsubmit = async e => {
    e.preventDefault(); error.textContent = '';
    const button = form.querySelector('button');
    if (!pending) {
      const content = form.content.value.trim(); if (!content) { error.textContent = 'Bạn chưa nhập nội dung.'; return; }
      pending = { id: crypto.randomUUID(), content }; form.content.disabled = true;
    }
    button.disabled = true; button.textContent = 'Đang phát…';
    try {
      await publishAnnouncement(pending.id, pending.content);
      if (!alive()) return;
      pending = null; form.reset(); form.content.disabled = false; toast('Đã phát thông báo cho mọi người.'); load();
    } catch (e) { if (alive()) error.textContent = adminError(e); }
    finally { if (alive()) { button.disabled = false; button.textContent = pending ? 'Thử phát lại cùng thông báo' : 'Phát thông báo cho mọi người'; } }
  };
  view.querySelector('#refresh-announcements').onclick = load;
  load();
}
