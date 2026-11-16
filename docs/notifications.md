# Thông báo

Vanilla JS dùng một store pub/sub, không cần React/Redux.

- `js/notifications/store.js`: state, subscribe, dismissed/read, cache 200 thông báo gần nhất theo UID.
- `js/notifications/data.js`: Firestore realtime, hủy listener khi đổi tài khoản.
- `js/notifications/ui.js`: banner và bell dùng chung state; Escape/click ngoài đóng dropdown.
- `css/notifications.css`: pastel, collapse bằng grid trong 300ms, reduced motion.

Model UI: `{ id, type: 'global_banner' | 'personal', content, isRead, createdAt }`.
Firestore dùng document ID làm id; createdAt là Timestamp. isRead và dismissed là trạng thái riêng từng người trên trình duyệt, không ghi vào thông báo chung.

Tạo thông báo chung tại `announcements/{id}` với `content` (string), `createdAt` (timestamp). Thông báo riêng ở `users/{uid}/notifications/{id}` cùng hai field. Loại được xác định từ collection. Admin có quyền ghi, người nhận có quyền đọc thông báo riêng. Publish firestore.rules mới trước khi dùng. Vào Quản Lý → Thông báo để soạn nội dung và bấm Phát thông báo cho mọi người. Danh sách bên dưới cho phép xem và xóa 30 thông báo gần nhất. Không cần tạo collection/document thủ công.

Đóng banner không đánh dấu đọc, vẫn còn trong chuông. Mở chuông đánh dấu các thông báo hiện có đã đọc. Thông báo mới trong khi dropdown mở cũng được đánh dấu đọc. Lịch sử đã nhận được giữ trên máy kể cả khi document nguồn bị xóa; tối đa 200 mục. Cờ đã đọc/đã đóng chưa đồng bộ giữa thiết bị.

Chạy `node --test test/notifications.cjs`.
