# Tiến độ Góc Học Nhỏ

Ngày 19/11/2026. Bản đối chiếu ban đầu là `c747585` trên `main`. Dùng [Front-End-Checklist](https://github.com/thedaviddias/Front-End-Checklist) để chọn tiêu chí kiểm tra và [clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript) để xem xét cách tổ chức code, xử lý lỗi và kiểm thử.

| Ưu tiên | Hạng mục | Code / kiểm thử / CI | Triển khai và xác minh thật | Còn thiếu |
| --- | --- | --- | --- | --- |
| Cao | Nhập bản sao JSON, báo lỗi lưu, popup bàn phím | Có code và test. CI đạt trên bản đối chiếu | GitHub Pages đã triển khai bản đối chiếu. Popup và lỗi lưu được kiểm tra trên Chromium với dữ liệu giả | Rà thêm dữ liệu bản sao cũ và các popup trên mobile |
| Cao | Đồng bộ Pomodoro và thời gian học | Có bộ test cộng dồn, chống đếm trùng và lỗi lưu. CI đạt trên bản đối chiếu | Có trên Pages. Chưa xác minh với hai thiết bị thật cùng đăng nhập | Kiểm tra gửi lại, mất mạng và chuyển tài khoản |
| Cao | Xóa dữ liệu khi đồng bộ | Thay nguyên trường `state` sau khi ghép dữ liệu. Test emulator tái hiện lỗi trên bản cũ, sau đó xác nhận bản sửa xóa bản ghi ngày và giữ dữ liệu thêm từ máy khác | Đã qua CI và Pages tại `b40c121`. File JavaScript đang phục vụ trên web chứa bản sửa | Chưa thử thao tác xóa trên tài khoản thật |
| Cao | Worker xác thực và kết nối Firestore | Có API kiểm tra chỉ đọc và test. CI đạt trên bản đối chiếu | Người dùng đã xác nhận kết nối đọc thành công bằng tài khoản thật. `/health` trả về cấu hình đầy đủ, chuyển ví đang tắt | Kiểm tra ghi qua Worker trên dự án thử nghiệm |
| Cao | Ví máy chủ: mua đồ, quản trị, Pomodoro, hoàn thành/hủy nhiệm vụ | Có code và test đơn vị. Bản Worker đóng gói đã qua test Firestore emulator cho hai yêu cầu mua khi chỉ đủ xu một lần, thử lại, phát xu và thu hồi quyền. Google OAuth và đăng nhập dùng phản hồi giả trong test này | Chưa xác minh các giao dịch trên Worker thật. Web đang dùng ví cũ | Thêm test REST cho Pomodoro/nhiệm vụ, tạo/sửa/xóa nhiệm vụ, thưởng tuần/chuỗi, frontend và chuyển dữ liệu |
| Cao | Rules và chuyển số dư/kho đồ | Có Rules cho dữ liệu ví máy chủ, test emulator và tài liệu chuyển đổi | Người dùng đã báo Publish Rules. Chưa chuyển tài khoản thật | Hoàn thiện Rules cuối cùng, công cụ dry-run, đối chiếu bản sao, diễn tập khôi phục và duyệt chính sách thưởng |
| Vừa | Responsive, accessibility, hiệu năng và bảo trì | Có kiểm tra popup, Admin và một số tiêu chí trong đợt đầu | Chưa đo hiệu năng thật hay kiểm tra đủ trình duyệt | Rà các luồng chính trên mobile, bàn phím và đo tải trang trước khi tối ưu |

- [CI của bản đối chiếu](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44519336478)
- [GitHub Pages của bản đối chiếu](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44519335661)
- [CI của bản sửa đồng bộ](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44520993014)
- [GitHub Pages của bản sửa đồng bộ](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44520992752)

Tiếp theo là kiểm thử các giao dịch ví với Firestore emulator, nối vòng đời nhiệm vụ máy chủ và xây phần thưởng tuần/chuỗi trên dữ liệu do máy chủ quản lý. Sau đó nối các màn hình, diễn tập chuyển dữ liệu rồi rà frontend. Các điểm khác chính sách hiện hành, như hạn mức thưởng sau thao tác hủy, cần được người dùng duyệt trước khi kích hoạt. Các bước chuyển ví thật và thay đổi thanh toán cũng cần xác nhận riêng.
