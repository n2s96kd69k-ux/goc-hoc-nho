# 🌷 Góc Học Nhỏ

> Một góc nhỏ cho những ngày cố gắng.

Góc Học Nhỏ là ứng dụng web lập kế hoạch ôn thi và theo dõi việc học bằng tiếng Việt. Giao diện dùng màu pastel, thẻ kế hoạch kiểu giấy và mèo Mochi đồng hành. Bạn có thể dùng ngay trên trình duyệt hoặc đăng nhập để đồng bộ dữ liệu học tập giữa các thiết bị.

[**Mở Góc Học Nhỏ**](https://gochocnho.id.vn) · [Tiến độ dự án](docs/progress.md) · [Kết quả CI](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/workflows/quality.yml)

## Các trang và tính năng

| Đường dẫn | Trang | Có thể làm gì |
| --- | --- | --- |
| `#/` | Tổng quan | Xem việc hôm nay và kế hoạch tuần, ghi tâm trạng, mở Pomodoro và xem banner thông báo chung. |
| `#/week` | Kế hoạch tuần | Chuyển tuần, lọc theo môn hoặc trạng thái, thêm/sửa/xóa nhiệm vụ, đánh dấu hoàn thành và kéo thả đổi thứ tự hoặc ngày. Trên điện thoại có thể chuyển giữa từng ngày. |
| `#/subjects` · `#/subjects?id=<id>` | Môn học | Quản lý môn, chương và điểm kiểm tra. Xem nhiệm vụ, số phiên Pomodoro và thời gian theo môn. |
| `#/pomodoro` | Pomodoro | Chọn 25/5, 50/10 hoặc thời lượng riêng. Gắn nhiệm vụ, tạm dừng, tiếp tục hoặc đặt lại. Đồng hồ vẫn xuất hiện khi chuyển sang trang khác. |
| `#/room` | Góc học | Tương tác với Mochi và phòng 2.5D. Dùng xu mua đồ, lấy đồ từ kho để trang trí, lưu bố cục và hoàn tác thao tác. Ánh sáng thay đổi theo giờ, thời tiết có chế độ tự động. |
| `#/stats` | Nhìn lại một chút | Xem thời gian học, số phiên Pomodoro, nhiệm vụ, chuỗi học, tiến độ theo môn và tâm trạng. |
| `#/goals` | Mục tiêu | Đặt mốc thi và điểm mục tiêu, xem đếm ngược và thông tin trường đại học. |
| `#/settings` | Cài đặt | Chỉnh hồ sơ, đồng hồ và âm thanh, xuất hoặc nhập bản sao JSON. |
| `#/admin` | Quản lý | Xem người dùng, phân quyền và khóa tài khoản, phát/đặt xu, quản lý thông báo, xem nhật ký và kiểm tra kết nối ví. Cần quyền quản trị. |

Thanh trên cùng hiển thị chuỗi học, số xu, chuông thông báo và số người trong phòng học chung. Bộ đếm cộng nền mô phỏng theo giờ Việt Nam với số tài khoản đang tập trung nhận từ Firestore. Banner thông báo chung xuất hiện trong Tổng quan; chuông dùng được ở các trang khác. [Cách đếm và đồng bộ](docs/study-presence.md) · [Thông báo](docs/notifications.md)

## Chạy cục bộ

Từ thư mục chứa `index.html`, chạy một máy chủ HTTP tĩnh bằng Python 3 rồi mở `http://localhost:8000/`.

```bash
python3 -m http.server 8000
```

Frontend dùng HTML, CSS và JavaScript ES modules, nên có thể chạy trực tiếp qua HTTP mà không cần bước build. Cấu hình Firebase mặc định trong `js/cloud.js` trỏ đến dự án thật. Bạn có thể xem giao diện ở chế độ khách. Để thử ghi dữ liệu mà không tác động tài khoản thật, dùng bộ test Firestore emulator bên dưới.

## Lưu trữ và đồng bộ

- **Chế độ khách** lưu kế hoạch trong `localStorage`. Cài đặt hỗ trợ xuất bản sao JSON và kiểm tra nội dung trước khi xác nhận nhập.
- **Tài khoản Firebase** đăng nhập bằng Google hoặc email/mật khẩu. Hồ sơ đám mây lưu trong Cloud Firestore. Bản nháp trên thiết bị được tách theo UID để giữ dữ liệu của từng tài khoản khi đổi phiên. Logic đồng bộ hợp nhất thay đổi từ nhiều thiết bị, gồm sự kiện Pomodoro và thời gian học.
- **Quản trị** dùng quyền từ hồ sơ Firebase và `firestore.rules`. Thao tác quản trị có nhật ký; thông báo cá nhân được giới hạn theo tài khoản. [Thiết lập quyền quản trị](docs/admin-setup.md)
- **Ví xu** trên website hiện dùng luồng cũ. Repo có luồng ví máy chủ qua Cloudflare Worker, chỉ chọn cho hồ sơ có `economyVersion: 1`. Đã xác nhận Worker thật xác thực được tài khoản quản trị và đọc Firestore. Chuyển ví thật đang tạm dừng và giao dịch ghi của ví mới chưa được xác minh trên hệ thống thật. [Trạng thái chuyển ví](docs/economy-rollout.md) · [Diễn tập chuyển và khôi phục](docs/wallet-migration.md)

## Cấu trúc mã nguồn

| Vị trí | Vai trò |
| --- | --- |
| `index.html`, `css/` | Khung trang, giao diện pastel, bố cục responsive, chuyển động và đồ họa phòng. |
| `js/main.js`, `js/router.js`, `js/pages/`, `js/components/` | Khởi động, điều hướng theo hash và giao diện. Góc học, Mục tiêu, Nhìn lại và Quản lý tải khi mở trang tương ứng. |
| `js/state.js`, `js/storage.js`, `js/cloud.js`, `js/sync.js` | Trạng thái, lưu cục bộ, Firebase Auth và đồng bộ Firestore. |
| `js/tasks.js`, `js/timer.js`, `js/studyPresence.js`, `js/studyBaseline.js` | Nhiệm vụ, đồng hồ, phiên học trực tuyến và nền mô phỏng của bộ đếm. |
| `js/room.js`, `js/items.js`, `js/placement.js`, `js/catBrain.js` | Kho đồ, danh mục, quy tắc sắp xếp và hành vi Mochi. |
| `js/admin/`, `js/notifications/` | Quản trị, thông báo chung và thông báo theo tài khoản. |
| `firestore.rules`, `firebase.json` | Quyền truy cập Firestore và cấu hình emulator. |
| `server/`, `worker/`, `scripts/` | Nghiệp vụ ví máy chủ, API Cloudflare và công cụ diễn tập chuyển dữ liệu. |
| `test/`, `.github/workflows/quality.yml`, `docs/` | Kiểm thử, CI và tài liệu vận hành. |

## Kiểm thử

Dùng Node.js 22 và Java 21 theo cấu hình CI. Java dùng cho Firestore emulator, trình duyệt Playwright dùng cho kiểm thử giao diện.

```bash
npm ci
npm test
npm run test:rules
npx playwright install --with-deps chromium
npm run test:ui
npm run test:quality-ui
```

| Lệnh | Phạm vi |
| --- | --- |
| `npm test` | Lưu trữ, nhập JSON, quản trị, thông báo, bộ đếm, đồng bộ phiên học và logic máy chủ. |
| `npm run test:rules` | Quyền truy cập và giao dịch trên Firestore emulator, dự án `demo-goc-hoc-nho`, cổng `8787`. |
| `npm run test:ui` | Kiểm thử giao diện quản trị qua Playwright. |
| `npm run test:quality-ui` | Điều hướng, bàn phím và focus, thông báo, lưu dữ liệu, màn hình nhỏ và các luồng tài khoản giả lập. CI chạy bộ đầy đủ trên Chromium và bộ kiểm tra nhanh trên Firefox/WebKit. |

Nếu đã cài Chromium, có thể đặt `CHROMIUM_PATH` tới tệp thực thi. Với Firefox hoặc WebKit, cài trình duyệt Playwright tương ứng rồi đặt `QUALITY_BROWSER=firefox` hoặc `QUALITY_BROWSER=webkit` khi chạy `npm run test:quality-ui`. Các trang `room-test.html`, `route-test.html` và `test/smoke.html` vẫn dùng được để kiểm tra thủ công qua máy chủ HTTP cục bộ.

## Triển khai

- **Website** dùng GitHub Pages với tên miền được khai báo trong `CNAME`. [Lịch sử triển khai GitHub Pages](https://github.com/n2s96kd69k-ux/goc-hoc-nho/deployments)
- **Quyền Firestore** được quản lý riêng trong Firebase Console. Khi cập nhật, dùng toàn bộ [`firestore.rules`](firestore.rules) và chạy kiểm thử emulator trước khi Publish. [Hướng dẫn về Rules](docs/wallet-rules.md)
- **Cloudflare Worker** được triển khai riêng. Dùng `npm run build:worker` để tạo `worker/worker.js` từ mã nguồn Worker. JSON tài khoản dịch vụ được lưu dưới dạng Cloudflare Secret. [Hướng dẫn Worker](worker/README.md)

## Tài liệu tham khảo

- [Front-End-Checklist](https://github.com/thedaviddias/Front-End-Checklist) cho responsive, khả năng truy cập và hiệu năng.
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript) cho tổ chức mã, xử lý lỗi và khả năng bảo trì.
