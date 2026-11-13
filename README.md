# 🌷 GÓC HỌC NHỎ
### “Một góc nhỏ cho những ngày cố gắng.”

Ứng dụng web lập kế hoạch & theo dõi ôn thi cá nhân theo phong cách **cute · cozy · pastel · stationery**, có linh vật mèo kem **Mochi** đồng hành, Pomodoro, **phòng học 2.5D sống động (Digital Study Room)** và game hóa nhẹ. Toàn bộ chạy trên trình duyệt, **không backend, không API**, dữ liệu lưu trong `localStorage`.

Triết lý bố cục: **MAIN = tờ planner tuần lớn trên bàn · SIDEBAR = cuốn sổ nhỏ chứa lịch, tiến độ, mục tiêu.** Riêng `/room` là một sân khấu (stage) để trang trí.

---

## ✅ Tính năng đã hoàn thành

### Weekly Planner (trung tâm)
- Bảng 7 ngày (Thứ 2 → Chủ nhật), mỗi ngày là một *planner card* kiểu giấy: tape, màu pastel riêng, vòng tiến độ, môn chính, danh sách nhiệm vụ với checkbox mềm, footer Pomodoro/thời gian.
- Trạng thái card: **Hôm nay** (viền nổi + sticker), **✨ HOÀN THÀNH** (sticker), ngày đã qua chưa xong (giảm sáng).
- Chuyển tuần trước / tuần sau / về tuần này; bộ lọc theo môn, hoàn thành, chưa xong.
- "Xem thêm" khi ngày có > 6 nhiệm vụ.
- Mobile: hiển thị **1 ngày/lần**, thanh ngày `T2 … CN`, **vuốt trái/phải** để đổi ngày.

### Nhiệm vụ
- Thêm / sửa / xóa / đổi ngày / đổi môn / đánh dấu xong / ghi chú / độ ưu tiên / số Pomodoro dự kiến.
- Tick task: animation checkbox, cập nhật vòng tiến độ, **+10 xu**, mascot phản ứng, toast "Xong một việc rồi ✨".
- Hoàn thành cả ngày: sparkle + **+50 xu** + "Hôm nay giỏi lắm 🌷".
- Hoàn thành cả tuần (≥ 5 nhiệm vụ, tất cả xong): **+100 xu**, mỗi tuần một lần.
- Trạng thái rỗng thân thiện với mascot.

### Sidebar (thông tin phụ)
- 📅 Lịch tháng nhỏ (chấm trạng thái ngày: học tốt / một phần / bỏ; bấm ngày → nhảy đến tuần hoặc mở chi tiết ngày).
- 📊 Tiến độ tuần (7 thanh nhỏ) · ⏱ Thời gian học tuần + mini bar · 🎯 Thẻ mục tiêu · 🐱 Mascot mini với lời nhắn · Navigation.

### Thanh "Hôm nay" (gọn, trên planner)
- Ngày, số nhiệm vụ, %, nhiệm vụ tiếp theo, chọn tâm trạng 😴🙂😊🔥, nút **🍅 BẮT ĐẦU TẬP TRUNG**.

### 🍅 Pomodoro (trang riêng)
- 25/5 · 50/10 · tùy chỉnh. Bắt đầu / tạm dừng / đặt lại. Chạy nền theo `Date` (chính xác khi tab ẩn), có **timer pill** nổi khi rời trang.
- Gắn nhiệm vụ đang làm → cộng thời gian cho môn.
- Hoàn thành: popup ✨ HOÀN THÀNH + confetti nhẹ, **+25 xu (tỉ lệ theo số phút)**, +1 Pomodoro, +N phút.
- Mascot chuyển *focus* (đeo tai nghe, mở laptop) khi tập trung, *rest* khi nghỉ.

### 🐱 Mascot Mochi (SVG + CSS, không ảnh ngoài)
- **10 trạng thái**: `idle` · `study` · `focus` · `sleepy` · `happy` · `celebrate` · `interact-*` · `walk` · `rest` · `night`.
- Idle có **thở, chớp mắt, vẫy tai, ve vẩy đuôi, nghiêng đầu** với chu kỳ **ngẫu nhiên không lặp** (biến CSS `--blink/--tail/--sway/--delay` khác nhau cho từng instance).
- Chạm vào mèo → phản ứng **khác nhau mỗi lần** (6 kiểu: look-left, look-right, wave, blink, wiggle, happy), có cooldown 700ms.
- Phụ kiện: tai nghe, nơ, vương miện, kính.

### 🎮 Game hóa
- Xu: task **+10** · Pomodoro **+25** (tỉ lệ theo phút) · hoàn thành ngày **+50** · hoàn thành tuần **+100** · chuỗi 7 ngày **+50** · chuỗi 14 ngày **+100**.
- Chuỗi cố gắng tự tính từ lịch sử học; chuỗi dài nhất được lưu.
- Đồng xu trên header **đếm tăng dần**; khi tiêu/cộng có **đồng xu bay** tới quầy xu.

### 🏡 GÓC HỌC CỦA TÔI — Digital Study Room 2.5D
Sân khấu nhiều lớp với **parallax** thật (nền 1–2px, giữa 3–5px, tiền cảnh 5–8px, mèo nhẹ) và **ánh sáng theo giờ**:
- **11 lớp**: tường → cửa sổ → rèm → đồ treo tường → kệ sách → bàn → ghế → đồ trên bàn → mèo → tiền cảnh → UI.
- **Thời gian trong ngày**: sáng / ban ngày / chiều / tối / đêm — chuyển mượt 2–2.5s (bầu trời, mặt trời/mặt trăng, sao, ánh sáng tổng).
- **Thời tiết** (không API): nắng / mây / mưa, `auto` chọn ổn định theo ngày.
- **Chi tiết ambient**: rèm đung đưa, cây rung nhẹ, hạt bụi bay, màn hình laptop phát sáng, cốc trà bốc khói, kim đồng hồ quay, mèo thở.
- **Easter egg**: bấm cửa sổ (rèm vén), bấm đèn (bật/tắt), bấm cây (rung), bấm đồng hồ (đọc giờ), bấm mèo (phản ứng), bấm laptop/cốc/sách (rung nhẹ).

#### Hai chế độ: XEM và TRANG TRÍ
- **VIEW MODE** (mặc định): phòng là để ngắm + tương tác. Không hiện lưới, không kéo được.
- **✨ TRANG TRÍ**: hiện lưới, đồ có thể chọn/kéo, hiện **thanh công cụ nổi** (↶ hoàn tác · ↷ làm lại · 💡 đèn · 🎨 phong cách) và **thanh công cụ vật phẩm** (↻ xoay · ⬆ lên trước · ⬇ ra sau · 📦 cất vào kho).

#### 🛒 Cửa hàng & 🎒 Kho (mua ≠ đặt)
- **8 nhóm**: Nội thất · Cây xanh · Học tập · Ánh sáng · Trang trí · Cho mèo · Đồ xinh · Phong cách phòng (~40 món, tự vẽ SVG/emoji).
- Luồng bắt buộc: **SHOP → MUA → INVENTORY → DECORATE → PLACE**. Mua **không** tự đặt đồ vào phòng.
- Sau khi mua: hỏi **“Đặt ngay”** hoặc **“Để trong kho”** (mặc định = vào kho).
- Trạng thái: nút giá → `✓ Đã sở hữu` (khi đạt `maxQty`) → hiển thị `×2 ×3` cho số đã có. **Không bao giờ cho mua lại khi đã đạt giới hạn.**

#### Hệ thống bề mặt & snap
- Bề mặt: `FLOOR` · `WALL` · `CEILING` · `DESK` · `SHELF` · `SOFA` · `BED` — mỗi món khai báo `surfaces[]` được phép đặt.
- **Smart snap**: kéo → hút vào bề mặt gần nhất theo *ý định* (ưu tiên bề mặt của vật thể khi con trỏ nằm trên thân nó), → **DRAG → SNAP → SETTLE** (spring).
- **Ghost preview** opacity ~0.6, hợp lệ xanh / không hợp lệ mờ + xám (không rung giật, không popup dữ dội). Thả ra: scale .96 → 1.
- **Va chạm 2D (bbox)**: không đặt ghế lên bàn, không đặt poster xuống sàn, không cho đồ ra ngoài phòng. Va chạm → tự dịch sang bên tìm chỗ trống, hết chỗ mới báo.
- **Độ sâu (z-index)** tính theo bề mặt + `y`, nên **mèo không bao giờ đi xuyên bàn**; đồ trên bàn nằm ngay trước bàn.
- **Cất vào kho** trả món đồ về kho **không mất quyền sở hữu**; đồ đặt trên nó được cất theo.
- **Undo / Redo** cho đặt · di chuyển · xoay · cất · đổi phong cách · bật/tắt đèn · thời tiết.

#### Phong cách & bố cục
- **4 theme**: Cream Cozy · Matcha Room · Sunset Room · Night Study (mua ở shop để mở khóa).
- **Preset bố cục**: lưu / áp dụng lại toàn bộ cách bày (theme + vị trí + xoay + đèn).
- **Thời tiết**: Tự động / Nắng / Mây / Mưa.

#### 🐱 Mèo sống trong phòng (catBrain)
- Mèo **đọc `roomState`**, không hard-code: có **bàn** → học ở bàn · có **sofa** → nằm nghỉ · có **ổ mèo** → ngủ · có **cây** → ngồi cạnh · có **kệ** → lại gần · **đêm + có đèn** → học dưới đèn.
- Pomodoro đang chạy → tới bàn ở trạng thái *focus*; nghỉ → sofa *rest*.
- **Không dịch chuyển tức thời**: mèo **đi bộ** giữa các anchor (CAT_DESK / CAT_SOFA / CAT_BED / CAT_PLANT / CAT_SHELF), thời gian tỉ lệ quãng đường, lật hướng theo chiều đi.

#### 📱 Mobile
- Chạm = chọn · **giữ 320ms = kéo** · chạm ra ngoài = bỏ chọn.
- Kho đồ / Shop / Phong cách mở dạng **bottom sheet** materialize từ dưới lên; có **FAB 🎒**.
- Thanh công cụ và lưới co giãn theo bề rộng.

### 📚 Môn học
- Card môn: %, thời gian, nhiệm vụ, Pomodoro. Chi tiết: chương/bài học, điểm kiểm tra, nhiệm vụ của môn. Tự tạo / sửa / xóa môn với icon & màu.

### 🎯 Mục tiêu
- Tên, biểu tượng, ngày thi, điểm mục tiêu, lời nhắn. Đếm ngược ngày, tiến độ, **timeline theo tháng đến ngày thi**.

### 📊 Nhìn lại một chút
- Tổng thời gian, Pomodoro, nhiệm vụ, chuỗi hiện tại/dài nhất, môn học nhiều nhất. Biểu đồ pastel 14 ngày (thời gian, task, Pomodoro), tiến độ môn, thống kê tâm trạng.

### ⚙ Cài đặt
- Tên, thời lượng Pomodoro/nghỉ, âm thanh bật/tắt, quản lý môn, mục tiêu, **📤 Xuất JSON**, **📥 Nhập JSON** (kiểm tra + xác nhận trước khi ghi đè), xóa dữ liệu mẫu, xóa toàn bộ (xác nhận 2 bước).

### 🎞 Motion & Glass (có chọn lọc)
- **Glass chỉ dùng cho**: thanh nav nổi, bottom nav mobile, popup, modal, thanh công cụ nổi, vài control, quầy xu, bong bóng trạng thái mascot. **Planner / phòng / nội dung vẫn là giấy kem pastel.** Không lồng glass trong glass.
- Spring/easing thống nhất (`--spring`, `--spring-soft`, `--fluid`); nút có shine sweep; chuyển trang 250–400ms (trang cũ mờ + thu nhẹ → trang mới materialize); drawer sidebar trượt + scale với stagger.
- **Tôn trọng `prefers-reduced-motion`**: tắt parallax/kính mờ chuyển động, giữ nguyên bố cục.
- Chỉ animate `transform` / `opacity`.

### 🔊 Âm thanh
- Web Audio tổng hợp (không file ngoài): pop (tick), ting (Pomodoro), plop (vật phẩm), coin, fanfare. Chỉ khởi tạo sau tương tác người dùng.

---

## 🗺 Cấu trúc trang (SPA hash router)

| Đường dẫn | Trang |
|---|---|
| `#/` | Tổng quan: thanh Hôm nay + Weekly planner |
| `#/week` | Kế hoạch tuần (chỉ planner) |
| `#/subjects` · `#/subjects?id=<id>` | Môn học / chi tiết môn |
| `#/pomodoro` | Pomodoro |
| `#/room` | Góc học của tôi (Digital Study Room) |
| `#/stats` | Nhìn lại một chút |
| `#/goals` | Mục tiêu |
| `#/settings` | Cài đặt |

---

## 🗂 Kiến trúc code

```
index.html
css/
  style.css        # design system pastel, layout, components
  mascot.css       # 10 trạng thái mascot + randomness vars
  room.css         # scene 2.5D: lớp, cửa sổ/rèm/mưa, ritem, đèn, tod-*, weather-*, ghost
  motion.css       # glass (có chọn lọc), spring, page transition, drawer stagger,
                   # modal/toast, coin-fly, UI trang phòng
  responsive.css   # tablet/mobile: carousel ngày, drawer, bottom nav, sheet
js/
  main.js          # boot, kết nối state ↔ UI, timer pill, page transition
  router.js        # hash router
  state.js         # state trung tâm + pub/sub + migrate (v1 → v2)
  storage.js       # localStorage, export/import JSON
  seed.js          # dữ liệu mẫu (dùng starterRoom từ items.js)
  utils.js         # ngày tháng, format, escape
  items.js         # CATALOG: 8 nhóm, 4 theme, ~40 món, starterRoom()
  placement.js     # bề mặt, snap, va chạm bbox, z-index/depth
  room.js          # owned/inventory/placed, mua, đặt, cất, undo/redo, theme, preset, migrate
  catBrain.js      # timeOfDay, catAnchors, decide, createCatController (đi bộ)
  tasks.js · subjects.js · timer.js · gamification.js
  statistics.js · mascot.js · sounds.js
  components/      # header, sidebar, calendar, planner, taskForm, dayDetail,
                   # modal, toast, reward, progressRing, roomScene, itemArt
  pages/           # overview, week, subjects, pomodoro, room, stats, goals, settings
test/smoke.html    # kiểm tra logic Phase 1 (console "SMOKE: ALL PASSED")
room-test.html     # 16 luồng bắt buộc của phòng (console "ROOM: ALL PASSED")
route-test.html    # tất cả route render + kinh tế xu (console "ROUTES: ALL PASSED")
```

> Ba file `*.html` ở gốc là **công cụ kiểm thử thủ công** (mở file → xem console). Không phải trang của app; có thể xoá trước khi publish nếu muốn gọn.

## 💾 Mô hình dữ liệu (localStorage key `goc-hoc-nho:v1`)

```js
{
  version: 2,
  settings: { userName, focusMinutes, breakMinutes, sound, seeded },
  subjects: [{ id, name, color, icon, chapters[], scores[] }],
  tasks: [{ id, title, subjectId, date:'YYYY-MM-DD', minutes, pomodoros, priority, note, done, createdAt, completedAt }],
  days: { 'YYYY-MM-DD': { minutes, pomodoros, mood, note } },
  wallet: { coins, totalEarned },
  streak: { current, longest, lastDate, rewarded },
  room: {
    theme: 'cream' | 'matcha' | 'sunset' | 'night',
    owned: { itemId: qty },          // sở hữu (mua 1 lần, mua nhiều nếu maxQty > 1)
    placed: [{                        // đồ đang bày trong phòng
      uid, itemId, x, y,              // x,y = % (anchor giữa cạnh dưới)
      surface: 'floor'|'wall'|'ceiling'|'desk'|'shelf'|'sofa'|'bed',
      parent: uid|null,               // uid của bàn/kệ/sofa/ổ mà món này nằm trên
      rot, zOff,
    }],
    lampOverride: null|bool,          // null = tự theo giờ
    weather: 'auto'|'sunny'|'cloudy'|'rain',
    presets: [{ name, theme, placed[], lampOverride, savedAt }],
    version: 2,
  },
  mascot: { accessory, name },
  goal: { name, examDate, targetScore, icon, note },
  timer: { totalFocusMinutes, totalPomodoros, bySubject, pomosBySubject },
  ui: { viewWeek, viewDay, filter }
}
```

**Quan hệ kho ↔ phòng:** `kho(itemId) = owned[itemId] − placed.filter(p => p.itemId === itemId).length`
(với phụ kiện mèo: trừ thêm 1 nếu đang đeo). Vì vậy **cất đồ không làm mất quyền sở hữu** và **không thể nhân bản đồ**.

**Migration v1 → v2:** `state.js` gọi `migrateRoom()`; `inventory[]` + `room.placed[{itemId,x,y}]` cũ được map id (`lamp→desk_lamp`, `plant→plant_small`, `flower→vase`, `star→star_lamp`, `bigtree→plant_big`), gộp vào `owned`, rồi đặt lại vị trí hợp lệ bằng `findFreeSpot()`. Xu, nhiệm vụ, cài đặt, mục tiêu được giữ nguyên.

Thời gian học của một ngày = phút Pomodoro thực + phút dự kiến của các nhiệm vụ đã hoàn thành.

---

## 🧪 Kiểm thử

| File | Nội dung | Kết quả mong đợi |
|---|---|---|
| `room-test.html` | 16 luồng bắt buộc: mua/kho/đặt/snap/reload/cất/đặt lại/đèn/poster/ghế-trên-bàn/bề mặt sai/mèo-đọc-phòng/đêm/undo-redo/va chạm/preset/pomodoro | console `ROOM: ALL PASSED` |
| `route-test.html` | 8 route đều render, không lộ `undefined`/`[object Object]`, kinh tế xu | console `ROUTES: ALL PASSED` |
| `test/smoke.html` | Logic Phase 1 (ngày, tuần, thống kê) | console `SMOKE: ALL PASSED` |

---

## 🚧 Chưa triển khai / ý tưởng tiếp theo
- Kéo thả nhiệm vụ giữa các ngày trực tiếp trên planner (hiện đổi ngày qua form sửa).
- Pinch-zoom / two-finger pan thật trong phòng (hiện mobile đã có chọn + long-press kéo, bottom sheet).
- Nhắc nhở / thông báo trình duyệt khi hết Pomodoro.
- Nhiều linh vật hoặc skin phòng theo mùa.
- Thử thách tuần (ví dụ "Học 5 giờ tuần này") với phần thưởng riêng.
- Đồng bộ đa thiết bị (hiện dùng xuất/nhập JSON thủ công).
- Lưu bằng IndexedDB nếu dữ liệu lớn hơn (~5MB).

## 🚀 Triển khai
Site tĩnh thuần — mở `index.html` hoặc publish qua **Publish tab**. Không cần cấu hình server.
