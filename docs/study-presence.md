# Số tài khoản đang học

Số hiển thị = nền mô phỏng theo giờ Việt Nam của `studyBaseline.js` + số tài khoản tập trung từ Firestore. Mỗi ngày theo giờ Việt Nam có một chuỗi random walk dùng seed chung, cập nhật mỗi 12 giây. Sáng 05–08h: 20–45; chiều 13–17:30: 60–120; tối 18:30–23h: 150–280; khuya 23:30–04:30: 10–50. Các khoảng chuyển tiếp được nội suy. Nhịp thường dịch -1 đến +2 về phía đường cong mục tiêu; mỗi nhịp chưa có đợt biến động có xác suất 4% khởi tạo tăng 15–30 trong 8 nhịp hoặc giảm 10–15 trong 15 nhịp (3 phút). Mọi nhịp, kể cả chuyển khung giờ, giảm tối đa 2 và tăng tối đa 4. Giới hạn khung giờ là mục tiêu, có thể cần vài nhịp để tiến vào khoảng mới. Hai phút quanh nửa đêm làm dịu dao động để đổi seed không nhảy số. Cache tối đa hai ngày, không lưu số ngẫu nhiên riêng theo tài khoản. Mọi tài khoản có cùng thời gian sẽ nhận cùng số nền; không cộng riêng tài khoản hiện tại lần nữa. Sai lệch đồng hồ thiết bị hoặc độ trễ mạng vẫn có thể gây chênh lệch tạm thời. Đây là số mô phỏng kết hợp người học thực, không phải số người thực hoàn toàn.

`js/studyPresence.js` theo dõi timer và Firebase Auth. Mỗi trang ghi một document `studyPresence/{uid}_{pageId}` gồm `uid`, `updatedAt` (server timestamp), `expiresAt`, `focusEndsAt`. Không lưu tên/email hay nội dung nhiệm vụ trong presence.

Tất cả người xem đăng ký Firestore realtime và đếm UID khác nhau còn hạn, đang trong phiên focus. Một tài khoản nhiều tab vẫn tính một lần; nếu một tab dừng nhưng tab khác còn tập trung thì tài khoản vẫn được tính. Khách xem được số chung nhưng không được tự ghi trạng thái học.

Bắt đầu/khôi phục focus ghi trạng thái; pause, reset, đổi preset hoặc kết thúc phiên gỡ trạng thái. Nhịp duy trì 30 giây, hạn 90 giây. Rời trang cố gắng gỡ document. Mất mạng, đóng trình duyệt hoặc hệ điều hành treo tab có thể khiến trạng thái còn lưu tối đa khoảng 90 giây; mọi người xem loại bản ghi hết hạn trong vòng kiểm tra 5 giây tiếp theo. Thời điểm kết thúc Pomodoro cũng được kiểm tra để không tính tiếp phiên đã hết giờ. Khi tab bị trình duyệt đình chỉ lâu, tài khoản có thể tạm không được tính đến khi tab hoạt động lại.

Khi chưa kết nối được Firestore, chỉ hiển thị nền mô phỏng; chưa cộng người học thực. Hai thiết bị cùng nhận trạng thái sau độ trễ mạng/snapshot, không phải đồng thời tuyệt đối từng mili giây.

## Kích hoạt

Publish toàn bộ `firestore.rules` mới trong Firebase Console. Bộ Rules bao gồm các phần quản trị, thông báo, trường/kỳ thi trước đó và khối `studyPresence` mới. Collection tự tạo khi người đăng nhập bắt đầu tập trung, không cần tạo thủ công. Không cần deploy Cloud Functions.

Có thể bật Firestore TTL cho field `expiresAt` của collection group `studyPresence` để dọn các document cũ. Việc đếm không phụ thuộc thời gian TTL thực sự xóa document.

## Kiểm tra

`node --test test/presence.cjs`: hết hạn, kết thúc phiên, dedup nhiều tab, hai tài khoản nhận cùng thay đổi bắt đầu/dừng với lớp Firestore giả dùng chung.

`npm run test:rules`: kiểm tra emulator quyền đọc chung, không giả mạo UID, không sửa/xóa trạng thái tài khoản khác, không đăng ký phiên có lease vượt giới hạn.

## Tích hợp đã có trong ứng dụng

`js/components/header.js` import hai service, khởi tạo listener một lần (không tạo lại khi render header):

```js
import { studyBaseline } from '../studyBaseline.js';
import { startStudyPresence } from '../studyPresence.js';
let active = null;
const paint = () => {
  const total = studyBaseline() + (active ?? 0);
  document.querySelectorAll('[data-live-count]').forEach(el => {
    el.textContent = String(total);
  });
};
const unsubscribe = startStudyPresence(count => { active = count; paint(); });
const interval = setInterval(paint, 1000); // Kiểm tra mốc; số nền đổi mỗi 12 giây.
// Khi hủy app/header vĩnh viễn: unsubscribe(); clearInterval(interval);
```

Pomodoro dùng `start()`, `pause()`, `reset()` của `js/timer.js` như hiện tại. Service đăng ký `onTimer` để xử lý `start`, `pause`, `reset`, `restore`, `complete:*`; không ghi Firebase theo từng tick. Không gọi tăng/giảm thủ công ở nút bấm vì sẽ đếm trùng. Chỉ phiên `focus` đang chạy được tính, không tính giờ nghỉ. `pagehide` vô hiệu hóa các lần ghi đang chờ và xóa lại nếu một lần ghi đang gửi hoàn tất muộn; `pageshow` đăng ký lại sau khi quay về trang từ browser cache.

Không có `onDisconnect()` trong Firestore. Xóa khi thoát là best effort, lease 90 giây là dự phòng. Không cần đổi Rules so với phiên bản đã có `studyPresence`; nếu chưa publish thì dùng toàn bộ file `firestore.rules` trong repo. Chưa kiểm chứng trên Firebase production nếu chưa có phiên đăng nhập và Rules đã publish.

Kiểm thử thuật toán: `node --test test/study-baseline.cjs test/presence.cjs`.
