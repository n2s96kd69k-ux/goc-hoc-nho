# Thiết lập Quản Lý

Ứng dụng vẫn dùng Vanilla JS, Firebase Auth và Firestore. Không chuyển framework, không đổi cấu trúc dữ liệu kỳ thi/logo hiện có.

## Kích hoạt trên Firebase thật

GitHub Pages chỉ triển khai HTML/CSS/JS. Security Rules phải được Publish riêng trên Firebase; việc commit `firestore.rules` không thay đổi Rules đang chạy.

1. Mở Firebase Console → project **goc-hoc-48ad4** → Authentication → Users. Sao chép Firebase **UID** của chủ ứng dụng (không dùng mã GHN).
2. Trong Firestore → Data → `users/{UID đó}`, đặt các field cấp cao nhất:
   - `role`: string `admin`
   - `owner`: boolean `true`
   - `status`: string `active`
   Giữ nguyên các field/dữ liệu đang có. Không dùng `state.role` hay `roleBook` để cấp quyền.
3. Firestore → Rules: sao lưu Rules cũ rồi thay bằng toàn bộ nội dung [`firestore.rules`](../firestore.rules), nhấn **Publish**. File này bao gồm quyền cho `users`, `adminLogs` và collection `universities` đang chứa logo/lịch thi.
4. Tải lại web, đăng nhập tài khoản chủ. **Quản Lý** xuất hiện dưới **Cài đặt** ở cuối sidebar; địa chỉ trực tiếp là `/#/admin`.
5. Kiểm tra bằng một tài khoản thường: không thấy Quản Lý, truy cập trực tiếp bị chuyển về `/`. Kiểm tra thêm tài khoản chủ thấy danh sách và có thể phát một lượng xu thử cho tài khoản kiểm thử.

Nếu dùng Firebase CLI đã đăng nhập đúng tài khoản, bước 3 có thể thay bằng:

```sh
npx firebase deploy --project goc-hoc-48ad4 --only firestore:rules
```

Không có thông tin đăng nhập Firebase quản trị trong repo. Không đưa service account JSON hoặc Admin SDK credentials vào mã trình duyệt.

## Cấu trúc

```text
css/admin.css                  Giao diện tối, responsive, chỉ áp dụng trong quản trị
js/admin/policy.js             Kiểm tra số xu, lý do và bảo vệ chủ/tài khoản hiện tại
js/admin/service.js            Query user, transaction và nhật ký
js/pages/admin.js              Người dùng / Phát xu / Nhật ký
js/cloud.js                    Trạng thái quyền và kiểm tra admin từ Firestore server
firestore.rules                Quyền truy cập thực tế trên máy chủ
firebase.json                  Rules + cấu hình emulator
```

## Quyền và di chuyển dữ liệu cũ

- Quyền có nguồn duy nhất: `users/{Firebase UID}.role`. Listener cập nhật menu/quyền khi tài khoản thay đổi. Mỗi lần mở trang quản trị và mỗi thao tác quan trọng đều xác minh lại từ server; lỗi mạng không được coi là có quyền.
- Mã GHN chỉ dùng hiển thị/tìm kiếm. Bỏ việc tự cấp admin từ mã GHN trong `saveCloudState`.
- Bỏ giao diện danh sách quyền trong popup tài khoản. Popup của admin có lối vào trang Quản Lý.
- `roleBook` cũ vẫn giữ trong dữ liệu để tham chiếu nhưng không còn cấp quyền. Chủ ứng dụng cần đối chiếu và cấp lại quyền cho những tài khoản thực sự cần quản trị; không tự động tin danh sách do từng người dùng lưu trước đây.
- Chỉ admin được liệt kê user, chỉnh quyền/trạng thái, phát xu và đọc nhật ký. Không cho sửa quyền/trạng thái của chính mình hoặc chủ có `owner: true`.
- “Khóa” chặn đọc/ghi hồ sơ Firestore riêng và thu hồi quyền quản trị. Không vô hiệu hóa Firebase Authentication và không xóa bản dữ liệu đã tải về trình duyệt. Muốn vô hiệu hóa tài khoản Auth hoàn toàn cần một backend dùng Firebase Admin SDK.
- Danh sách phân trang 20 user, tìm chính xác UID/email/mã GHN. User cũ thiếu email/ảnh sẽ hiện trạng thái thiếu; hồ sơ được cập nhật khi họ đăng nhập và đồng bộ lại.

## Xu và nhật ký

- Giữ hệ thống phần thưởng học tập hiện tại. `adminCredits` ở cấp cao nhất document user lưu tổng điều chỉnh do admin, độc lập với snapshot học tập từ trình duyệt.
- Số dư hiển thị = xu trong snapshot + chênh lệch điều chỉnh chưa áp dụng. `state.wallet.adminCreditsApplied` tránh cộng lặp khi tải lại/đồng bộ. Bản sao cuối đã đồng bộ được hiệu chỉnh trước khi gộp để giữ cả xu học offline và xu được phát.
- Phát xu và đặt số dư mới dùng transaction đọc số dư mới nhất trên server, cùng lúc ghi user và `adminLogs/{operationId}`. Thử lại cùng mã thao tác không cộng thêm lần nữa. Hai giao dịch khác nhau được Firestore xử lý xung đột.
- Mỗi thay đổi quyền/trạng thái/xu cần lý do, UID người thực hiện, UID người nhận, giá trị trước/sau và thời gian server. Nhật ký không được sửa/xóa qua client, kể cả admin.
- Cơ chế này bảo vệ **quyền quản trị và các khoản điều chỉnh admin**. Phần thưởng học tập vẫn tính ở client như trước; `state.wallet` còn thuộc state cá nhân nên đây chưa phải hệ thống chống gian lận tiền ảo. Nếu cần nền kinh tế có giá trị hoặc bảng xếp hạng cạnh tranh, cần chuyển thưởng/chi tiêu sang backend và sổ giao dịch có thẩm quyền. Không tuyên bố rằng transaction tự chống được client giả mạo.

## Kiểm thử

Node 20+; Java 21 để chạy Firestore Emulator. Chỉ dùng project giả `demo-goc-hoc-nho`, không đọc/ghi dữ liệu Firebase thật.

```sh
npm ci
npm test
npm run test:rules
npx playwright install chromium
npm run test:ui
```

Có thể dùng Chrome/Chromium cài sẵn bằng `CHROMIUM_PATH=/đường/dẫn/chromium npm run test:ui`.

- Unit: route guard, phân quyền, kiểm tra giao dịch, chống lặp, giữ xu admin khi đồng bộ offline, cùng các kiểm tra lưu dữ liệu/Pomodoro trước đó.
- Emulator: chặn khách/user thường, chống tự nâng quyền, tài khoản bị khóa, quyền dữ liệu dùng chung, nhật ký bất biến, transaction phát xu đồng thời.
- Browser: trang thật với lớp dữ liệu Firebase giả, kiểm tra menu, chỉnh/phát xu, xác nhận, nhật ký, responsive và thu hồi quyền. Không thay thế kiểm tra Rules trên emulator hoặc bước xác minh sau khi Publish Firebase thật.
