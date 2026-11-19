# Diễn tập chuyển ví Góc Học Nhỏ

Công cụ trong `scripts/wallet-migration.mjs` lập kế hoạch ngoại tuyến. Các lệnh đọc, ghi và khôi phục kết nối Firestore chỉ nhận dự án `demo-*` và địa chỉ emulator cục bộ. Kế hoạch có thể chứa ghi chú, nhiệm vụ và nội dung cá nhân. Lưu bản sao và kế hoạch trong thư mục riêng ngoài repo.

## Chạy thử từ bản sao

Tạo `profile.json` có ba trường `uid`, `asOf` (Unix milliseconds) và `profile` (dữ liệu document `users/{uid}` dạng JSON ứng dụng). Cần đối chiếu `profile.adminCredits` từ Firestore cùng `profile.state.wallet.adminCreditsApplied`. File tải từ Cài đặt chỉ chứa `state`, nên một mình file đó chưa đủ để đối chiếu xu quản trị.

```sh
node scripts/wallet-migration.mjs plan /tmp/ghn-profile.json /tmp/ghn-wallet-plan.json
node scripts/wallet-migration.mjs catalog /tmp/ghn-catalog.json
```

Lệnh tạo file mới với quyền đọc và ghi cho tài khoản hệ điều hành hiện tại. Plan liệt kê số dư cũ và mới, tổng xu đã nhận, phút ghi tay, số document cùng nội dung sẽ chuyển. Số dư dùng cùng công thức với web cũ, cộng chênh lệch xu quản trị đúng một lần. Catalog lấy giá và giới hạn từ mã cửa hàng.

Kế hoạch giữ bố cục, kho đồ, nhiệm vụ, lịch sử ngày và mốc thưởng đã biết. Phút Pomodoro cũ nằm trong `studyDays`. Phút ghi tay và số liệu theo môn trước khi chuyển tiếp tục được đọc từ bản `state` đã đóng băng. Các phiên mới cập nhật số liệu theo môn ở `studyDays`. Bản diễn tập hiện dừng khi tổng số document vượt giới hạn một giao dịch, để tránh chuyển dở dang.

Bản cũ chỉ lưu ngày trao mốc chuỗi. Kế hoạch giữ hai ngày kết thúc khả dĩ để tránh phát lại, và ghi cảnh báo cần duyệt. Cần đối chiếu dữ liệu mẫu, nhiệm vụ cũ còn xu sau khi bị bỏ dấu hoàn thành, giới hạn xu nhiệm vụ và tác động của quy tắc hoàn xu trước khi bật trên tài khoản thật.

## Diễn tập trên emulator

```sh
npm ci
npm run test:rules
```

Bộ kiểm thử chuẩn bị tài khoản mẫu, chụp bản sao Firestore có checksum, lập kế hoạch, kiểm tra hồ sơ đã đổi thì công cụ từ chối, chuyển nguyên tử, đối chiếu Rules, khôi phục và xác nhận khôi phục bị chặn khi đã có giao dịch. Công cụ tính checksum để phát hiện thay đổi file do nhầm lẫn. Giữ bản sao trong nơi kiểm soát quyền truy cập.

Nếu emulator đang chạy và đã có tài khoản thử, có thể chạy từng bước:

```sh
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8787
node scripts/wallet-migration.mjs snapshot demo-goc-hoc-nho student /tmp/ghn-emulator-backup.json
node scripts/wallet-migration.mjs plan /tmp/ghn-emulator-backup.json /tmp/ghn-emulator-plan.json
node scripts/wallet-migration.mjs seed-catalog demo-goc-hoc-nho
node scripts/wallet-migration.mjs apply /tmp/ghn-emulator-backup.json
node scripts/wallet-migration.mjs restore /tmp/ghn-emulator-backup.json
```

`apply` tạo dữ liệu cá nhân và marker trong một giao dịch, kiểm tra phiên bản hồ sơ và các collection đích. Catalog được chuẩn bị độc lập và giữ nguyên qua lần khôi phục một tài khoản. `restore` kiểm tra toàn bộ hồ sơ và dữ liệu ví từ lúc chuyển, sau đó chỉ gỡ các document do chuyển ví tạo và phục hồi hai trường hồ sơ đã thay đổi. Công cụ dừng nếu hồ sơ đã chỉnh sửa hoặc ví có thêm giao dịch.

## Điều kiện trước khi chạy thử trên hệ thống thật

1. Xác nhận chính sách chuyển lịch sử và các điểm khác trong quy tắc thưởng. Đối chiếu bản sao Firestore với xu, đồ sở hữu, đồ đang đặt, lịch sử và nhiệm vụ mà người dùng thấy. Chờ các thiết bị cũ đồng bộ xong và kết thúc Pomodoro.
2. Deploy Worker tương ứng, xác nhận trình duyệt đã tải frontend mới và Publish bản Rules đầy đủ. Kiểm tra read-only trước, sau đó xác nhận điều kiện triển khai giới hạn cho một tài khoản thử đã được duyệt.
3. Sao lưu riêng hồ sơ và các collection đích, kiểm tra checksum và lưu phiên bản bản sao cùng báo cáo. Đối chiếu với catalog chuẩn bị từ mã đang triển khai.
4. Chỉ khi có xác nhận riêng mới mở đường chuyển thật. Dừng luồng vận hành và giữ đủ biên nhận trước khi khôi phục. Khi đã có giao dịch, chụp dữ liệu hiện tại, đối chiếu số dư, kho, nhiệm vụ và biên nhận trước khi chọn một phương án sửa tiếp hoặc hoàn nguyên từng thay đổi.
