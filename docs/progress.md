# Tiến độ Góc Học Nhỏ

Ngày 19/11/2026. Bản đối chiếu ban đầu là `c747585` trên `main`. Dùng [Front-End-Checklist](https://github.com/thedaviddias/Front-End-Checklist) để chọn tiêu chí kiểm tra và [clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript) để xem xét cách tổ chức code, xử lý lỗi và kiểm thử.

| Ưu tiên | Hạng mục | Code / kiểm thử / CI | Triển khai và xác minh thật | Còn thiếu |
| --- | --- | --- | --- | --- |
| Cao | Nhập bản sao JSON, báo lỗi lưu, popup bàn phím | Có code và test. CI đạt trên bản đối chiếu | GitHub Pages đã triển khai bản đối chiếu. Popup và lỗi lưu được kiểm tra trên Chromium với dữ liệu giả | Rà thêm dữ liệu bản sao cũ và các popup trên mobile |
| Cao | Đồng bộ Pomodoro và thời gian học | Có bộ test cộng dồn, chống đếm trùng và lỗi lưu. CI đạt trên bản đối chiếu | Có trên Pages. Chưa xác minh với hai thiết bị thật cùng đăng nhập | Kiểm tra gửi lại, mất mạng và chuyển tài khoản |
| Cao | Xóa dữ liệu khi đồng bộ | Thay nguyên trường `state` sau khi ghép dữ liệu. Test emulator tái hiện lỗi trên bản cũ, sau đó xác nhận bản sửa xóa bản ghi ngày và giữ dữ liệu thêm từ máy khác | Đã qua CI và Pages tại `b40c121`. File JavaScript đang phục vụ trên web chứa bản sửa | Chưa thử thao tác xóa trên tài khoản thật |
| Cao | Worker xác thực và kết nối Firestore | Có API kiểm tra chỉ đọc và test. CI đạt trên bản đối chiếu | Người dùng đã xác nhận kết nối đọc thành công bằng tài khoản thật. `/health` trả về cấu hình đầy đủ, chuyển ví đang tắt | Kiểm tra ghi qua Worker trên dự án thử nghiệm |
| Cao | Ví máy chủ: mua đồ, quản trị, Pomodoro và nhiệm vụ | Có code và test đơn vị. Bản Worker đóng gói đã qua test Firestore emulator cho hai yêu cầu mua khi chỉ đủ xu một lần, thử lại, phát xu và thu hồi quyền. API nhiệm vụ có tạo/sửa/xóa, xác thực phiên bản và chống tạo lại ID đã xóa. Emulator kiểm tra toàn bộ vòng đời nhiệm vụ. Google OAuth và đăng nhập dùng phản hồi giả | Chưa xác minh các giao dịch trên Worker thật. Web đang dùng ví cũ | Thêm test REST cho Pomodoro và chuỗi, nối frontend và chuyển dữ liệu |
| Cao | Thưởng tuần và chuỗi | Code dùng tổng ngày do máy chủ quản lý, có biên nhận riêng cho từng mốc. Test tuần trên emulator và test chuỗi qua 14 ngày, gửi lại và qua nửa đêm bằng đồng hồ mô phỏng | Chuẩn bị trong repo, chưa cập nhật Worker thật | Chuyển thống kê và mốc đã nhận, nối hiển thị thưởng và kiểm thử chuỗi trên emulator |
| Cao | Frontend phát và đặt xu | Trang Quản lý đọc số dư máy chủ nếu hồ sơ có `economyVersion: 1`. Giao dịch kiểm tra ví và biên nhận cũ trước khi chọn luồng. Có test thử lại sau mất phản hồi và đổi tài khoản khi đang gửi. Worker ghi nhật ký theo định dạng hiện tại | Ví thật chưa được chuyển và các lệnh mới chưa chạy trên Worker thật | Công cụ chuyển ghi marker cùng ví. Nối màn hình người học, rồi xác minh phát/đặt xu thật trong đợt thử nghiệm |
| Cao | Ví và cửa hàng trên frontend người học | Với marker chuyển ví, thanh trên cùng và cửa hàng đọc số dư, catalog, kho đồ máy chủ. Kiểm thử Chromium dùng dữ liệu giả lập xác nhận giá catalog, mất phản hồi, tải lại web và thử lại cùng mã mua | Dành cho đợt chuyển ví, chưa kích hoạt tài khoản thật | Nối Pomodoro/nhiệm vụ, lưu cấu hình và bố cục phòng với tài khoản đã chuyển, diễn tập dữ liệu thật |
| Cao | Đồng bộ cài đặt và phòng cho tài khoản đã chuyển ví | Tách hồ sơ học tập có thể sửa sang trường `planner`. Test emulator kiểm tra hợp nhất từ hai thiết bị và chặn ghi xu/kho đồ qua dữ liệu cá nhân | Rules và frontend chuẩn bị trong repo | Publish cùng bản tích hợp cuối, migrate trường planner và thử trên tài khoản thử |
| Cao | Tách dữ liệu khi đổi tài khoản | Có test hồi quy cho hồ sơ mới nhận dữ liệu từ trạng thái cục bộ thuộc tài khoản khác. Bản sửa chỉ lấy dữ liệu khách hoặc dữ liệu đúng UID | CI và Pages đạt tại `117567c` | Thử đổi tài khoản trên hai tab, gồm tình huống mất mạng |
| Cao | Nối giao diện nhiệm vụ với ví máy chủ | Hồ sơ đã chuyển ví đọc danh sách theo thời gian thực. Form thêm/sửa/xóa và nút hoàn thành gửi lệnh Worker. Test Chromium giả lập mất phản hồi rồi tải lại và gửi cùng mã tạo. Emulator kiểm tra sửa chồng phiên bản, biên nhận và quyền riêng tư của danh sách | CI và Pages đạt ở `9103526`. File web thật đã có mã kết nối mới. Chưa deploy Worker hay Publish Rules mới | Kiểm tra sửa/xóa trên trình duyệt với emulator, thao tác kéo thả và chuyển môn, phản hồi thưởng, đổi tài khoản và Pomodoro trước khi bật chuyển ví |
| Cao | Vòng đời phiên Pomodoro trên máy chủ | Phiên hết hạn được đóng khi bắt đầu phiên mới. Test đơn vị xác minh không cộng xu cho phiên hết hạn. Worker chạy trên emulator từ chối hoàn thành trước giờ và cộng xu một lần khi hai yêu cầu hoàn thành cùng tới | CI và Pages đạt tại `5a50995`. Chưa cập nhật Worker thật | Đồng bộ thống kê cùng phiên |
| Cao | Đồng hồ Pomodoro dùng phiên máy chủ | Bắt đầu, tạm dừng, tiếp tục, đặt lại và hoàn thành đi qua Worker. Đồng hồ nhận phiên đang hoạt động qua Firestore. Unit test ngăn thao tác cũ chèn vào phiên đã đổi. Chromium với Firestore và API giả lập kiểm tra mất phản hồi, thử lại, đổi tài khoản và không cộng xu cục bộ | CI và Pages đạt tại `47e123a`. Chưa xác minh bằng hai thiết bị thật | Thử phiên qua Worker với hai thiết bị thật |
| Cao | Thống kê ngày, môn và chuỗi học từ máy chủ | Trang học và thanh trên cùng đọc `studyDays`. Worker tăng số phút và số phiên theo môn trong cùng giao dịch. Emulator xác minh chỉ tăng một lần. Chromium kiểm tra cập nhật số phút, môn và chuỗi qua snapshot giả lập | CI và Pages đạt tại `c8059dd`. Chưa cập nhật Worker thật | Migrate tổng Pomodoro theo ngày và giữ thống kê theo môn, đối chiếu lịch sử từ bản sao trước khi chuyển |
| Cao | Rules và chuyển số dư/kho đồ | Có Rules cho dữ liệu ví máy chủ, test emulator và tài liệu chuyển đổi | Người dùng đã báo Publish Rules. Chưa chuyển tài khoản thật | Hoàn thiện Rules cuối cùng, công cụ dry-run, đối chiếu bản sao, diễn tập khôi phục và duyệt chính sách thưởng |
| Cao | Chạy thử chuyển ví và khôi phục | Có công cụ lập kế hoạch ngoại tuyến, bản sao có checksum, catalog và giao dịch chuyển/khôi phục trên emulator. Test kiểm tra giữ số dư, kho, nhiệm vụ, lịch sử, quyền ghi và từ chối khôi phục sau giao dịch mới | Chế độ ghi giới hạn ở emulator. Chưa bật chuyển thật | Duyệt chính sách dữ liệu cũ, hoàn thiện luồng còn thiếu và chạy đối chiếu với tài khoản thử đã được xác nhận |
| Vừa | Responsive, accessibility, hiệu năng và bảo trì | Có kiểm tra popup, Admin và một số tiêu chí trong đợt đầu | Chưa đo hiệu năng thật hay kiểm tra đủ trình duyệt | Rà các luồng chính trên mobile, bàn phím và đo tải trang trước khi tối ưu |

- [CI của bản đối chiếu](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44519336478)
- [GitHub Pages của bản đối chiếu](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44519335661)
- [CI của bản sửa đồng bộ](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44520993014)
- [GitHub Pages của bản sửa đồng bộ](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44520992752)

Tiếp theo là hoàn thiện các thao tác bổ sung của nhiệm vụ và nối Pomodoro với dữ liệu tài khoản máy chủ. Công cụ chuyển cần ghi `planner` cùng marker hồ sơ và ví. Bản Rules đã gộp nằm ở `firestore.rules` và sẽ được đối chiếu lại ở mốc nối nhiệm vụ, trước khi Publish. Sau đó diễn tập chuyển dữ liệu và rà frontend. Các điểm khác chính sách hiện hành, như hạn mức thưởng sau thao tác hủy, cần được người dùng duyệt trước khi kích hoạt. Các bước chuyển ví thật và thay đổi thanh toán cũng cần xác nhận riêng.

CI của mốc kiểm thử Worker `6c399a2` chạy đạt unit test và Firestore emulator. Hai bộ kiểm thử giao diện bị bỏ qua do runner Ubuntu không tải được gói font trong bước cài Chromium. Workflow đã chuyển từ `ubuntu-latest` sang `ubuntu-24.04`. [Log CI](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44521414969)

CI của thưởng tuần/chuỗi đã đạt sau khi ghim Ubuntu 24.04. [Kết quả CI](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44522986949)

- [CI của đồng bộ planner và tách dữ liệu khi đổi tài khoản](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44525115509)
- [Pages của đồng bộ planner và tách dữ liệu khi đổi tài khoản](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44525115254)

- [CI của kết nối giao diện nhiệm vụ](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44526140656)
- [Pages của kết nối giao diện nhiệm vụ](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44526140304)

- [CI của vòng đời phiên Pomodoro trên máy chủ](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44526481010)

- [CI của đồng bộ đồng hồ Pomodoro](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44527432166)
- [Pages của đồng bộ đồng hồ Pomodoro](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44527430724)

- [CI của thống kê máy chủ](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44527969495)
- [Hướng dẫn chạy thử chuyển và khôi phục ví](wallet-migration.md)
