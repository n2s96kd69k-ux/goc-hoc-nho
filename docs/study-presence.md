# Số tài khoản đang học

Đã bỏ bộ đếm giả theo giờ/ngẫu nhiên, phép cộng riêng trên máy và số người theo môn giả trong hộp Phòng học chung.

`js/studyPresence.js` theo dõi timer và Firebase Auth. Mỗi trang ghi một document `studyPresence/{uid}_{pageId}` gồm `uid`, `updatedAt` (server timestamp), `expiresAt`, `focusEndsAt`. Không lưu tên/email hay nội dung nhiệm vụ trong presence.

Tất cả người xem đăng ký Firestore realtime và đếm UID khác nhau còn hạn, đang trong phiên focus. Một tài khoản nhiều tab vẫn tính một lần; nếu một tab dừng nhưng tab khác còn tập trung thì tài khoản vẫn được tính. Khách xem được số chung nhưng không được tự ghi trạng thái học.

Bắt đầu/khôi phục focus ghi trạng thái; pause, reset, đổi preset hoặc kết thúc phiên gỡ trạng thái. Nhịp duy trì 30 giây, hạn 90 giây. Rời trang cố gắng gỡ document. Mất mạng, đóng trình duyệt hoặc hệ điều hành treo tab có thể khiến trạng thái còn lưu tối đa khoảng 90 giây; mọi người xem loại bản ghi hết hạn trong vòng kiểm tra 5 giây tiếp theo. Thời điểm kết thúc Pomodoro cũng được kiểm tra để không tính tiếp phiên đã hết giờ. Khi tab bị trình duyệt đình chỉ lâu, tài khoản có thể tạm không được tính đến khi tab hoạt động lại.

Trạng thái kết nối chưa có dữ liệu server hiển thị `…`, không hiển thị số giả. Hai thiết bị cùng nhận trạng thái sau độ trễ mạng/snapshot, không phải đồng thời tuyệt đối từng mili giây.

## Kích hoạt

Publish toàn bộ `firestore.rules` mới trong Firebase Console. Bộ Rules bao gồm các phần quản trị, thông báo, trường/kỳ thi trước đó và khối `studyPresence` mới. Collection tự tạo khi người đăng nhập bắt đầu tập trung, không cần tạo thủ công. Không cần deploy Cloud Functions.

Có thể bật Firestore TTL cho field `expiresAt` của collection group `studyPresence` để dọn các document cũ. Việc đếm không phụ thuộc thời gian TTL thực sự xóa document.

## Kiểm tra

`node --test test/presence.cjs`: hết hạn, kết thúc phiên, dedup nhiều tab, hai tài khoản nhận cùng thay đổi bắt đầu/dừng với lớp Firestore giả dùng chung.

`npm run test:rules`: kiểm tra emulator quyền đọc chung, không giả mạo UID, không sửa/xóa trạng thái tài khoản khác, không đăng ký phiên có lease vượt giới hạn.
