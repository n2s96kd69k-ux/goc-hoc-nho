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
| Cao | Đồng bộ cài đặt và phòng cho tài khoản đã chuyển ví | Tách hồ sơ học tập có thể sửa sang trường `planner`. Test emulator kiểm tra hợp nhất từ hai thiết bị và chặn ghi xu/kho đồ qua dữ liệu cá nhân | Người dùng báo đã Publish Rules 407 dòng từ `3f0c444` | Thử ghi planner bằng tài khoản đã chuyển trong môi trường thử nghiệm |
| Cao | Tách dữ liệu khi đổi tài khoản | Có test hồi quy cho hồ sơ mới nhận dữ liệu từ trạng thái cục bộ thuộc tài khoản khác. Bản sửa chỉ lấy dữ liệu khách hoặc dữ liệu đúng UID | CI và Pages đạt tại `117567c` | Thử đổi tài khoản trên hai tab, gồm tình huống mất mạng |
| Cao | Nối giao diện nhiệm vụ với ví máy chủ | Hồ sơ đã chuyển ví đọc danh sách theo thời gian thực. Form thêm/sửa/xóa và nút hoàn thành gửi lệnh Worker. Test Chromium giả lập mất phản hồi rồi tải lại và gửi cùng mã tạo. Emulator kiểm tra sửa chồng phiên bản, biên nhận và quyền riêng tư của danh sách | CI và Pages đạt ở `9103526`. File web thật đã có mã kết nối mới. Người dùng báo đã Publish Rules mới. Chưa deploy Worker mới | Kiểm tra sửa/xóa trên trình duyệt với emulator, phản hồi thưởng và đổi tài khoản trước khi bật chuyển ví |
| Cao | Vòng đời phiên Pomodoro trên máy chủ | Phiên hết hạn được đóng khi bắt đầu phiên mới. Test đơn vị xác minh không cộng xu cho phiên hết hạn. Worker chạy trên emulator từ chối hoàn thành trước giờ và cộng xu một lần khi hai yêu cầu hoàn thành cùng tới | CI và Pages đạt tại `5a50995`. Chưa cập nhật Worker thật | Đồng bộ thống kê cùng phiên |
| Cao | Đồng hồ Pomodoro dùng phiên máy chủ | Bắt đầu, tạm dừng, tiếp tục, đặt lại và hoàn thành đi qua Worker. Đồng hồ nhận phiên đang hoạt động qua Firestore. Unit test ngăn thao tác cũ chèn vào phiên đã đổi. Chromium với Firestore và API giả lập kiểm tra mất phản hồi, thử lại, đổi tài khoản và không cộng xu cục bộ | CI và Pages đạt tại `47e123a`. Chưa xác minh bằng hai thiết bị thật | Thử phiên qua Worker với hai thiết bị thật |
| Cao | Thống kê ngày, môn và chuỗi học từ máy chủ | Trang học và thanh trên cùng đọc `studyDays`. Worker tăng số phút và số phiên theo môn trong cùng giao dịch. Emulator xác minh chỉ tăng một lần. Chromium kiểm tra cập nhật số phút, môn và chuỗi qua snapshot giả lập | CI và Pages đạt tại `c8059dd`. Chưa cập nhật Worker thật | Migrate tổng Pomodoro theo ngày và giữ thống kê theo môn, đối chiếu lịch sử từ bản sao trước khi chuyển |
| Cao | Rules và chuyển số dư/kho đồ | Có Rules cho dữ liệu ví máy chủ, test emulator và tài liệu chuyển đổi | Người dùng báo đã Publish Rules 407 dòng từ `3f0c444`. Đã kiểm tra các quyền đọc công khai và từ chối đọc riêng tư trên Firestore thật | Xác minh quyền bằng tài khoản thử và duyệt chính sách trước khi chuyển ví thật |
| Cao | Chạy thử chuyển ví và khôi phục | Có công cụ lập kế hoạch ngoại tuyến, bản sao có checksum, catalog và giao dịch chuyển/khôi phục trên emulator. Test kiểm tra giữ số dư, kho, nhiệm vụ, lịch sử, quyền ghi và từ chối khôi phục sau giao dịch mới | CI và Pages đạt tại `8f8e939`. Chế độ ghi giới hạn ở emulator. Chưa bật chuyển thật | Duyệt chính sách dữ liệu cũ, hoàn thiện luồng còn thiếu và chạy đối chiếu với tài khoản thử đã được xác nhận |
| Cao | Kéo thả và chuyển môn cho nhiệm vụ máy chủ | Worker xếp lại nhiệm vụ theo phiên bản trong một giao dịch, kiểm tra đích và giữ số xu đã nhận khi kéo việc xong sang ngày tương lai. Khi xóa môn, Worker đổi môn cho các nhiệm vụ liên quan trong cùng giao dịch và chặn tab cũ khôi phục môn đã xóa. Chromium kiểm tra thao tác kéo thả. Emulator kiểm tra thứ tự, thống kê hai ngày, gửi lại và lưu dữ liệu từ tab cũ | CI và Pages đạt tại `dbd3e15`. Chưa deploy Worker mới | Xác minh qua hai thiết bị thật và rà lưu trữ trong Cài đặt trước khi chuyển ví |
| Cao | Sao lưu và Cài đặt khi dùng ví máy chủ | Xuất số dư, kho, nhiệm vụ và lịch sử đã tải từ Firestore. Thẻ loại bản sao ngăn nhập nhầm vào ví cũ. Nhập cài đặt, mục tiêu và ghi chú dùng đường lưu planner. Chromium tải file và mở hộp chọn file bằng bàn phím, kiểm tra số dư sau nhập. Test chuyển trang phát hiện và xác nhận sửa lỗi Pomodoro còn lắng nghe sau khi rời trang | Mã trong repo. Chưa thử trên tài khoản đã chuyển thật | Luồng xóa mẫu và xóa toàn bộ phía máy chủ chờ duyệt dữ liệu và quy trình khôi phục. Bản xuất từ trình duyệt dùng để đối chiếu, không thay thế bản sao Firestore cho vận hành |
| Cao | Cách ly dữ liệu khi đăng xuất, đổi hoặc khóa tài khoản | Bản nháp tách theo UID, đọc được khóa lưu trữ cũ của đúng tài khoản. Đóng hộp thoại và chặn kết quả đồng bộ cũ khi đổi phiên. Thử trên Chromium ngoại tuyến và unit test cho lỗi dung lượng, yêu cầu trả muộn, đổi và khóa tài khoản | CI và Pages đạt tại `ec8aa9a`. Chưa xác minh với đăng nhập thật trên hai thiết bị | Kiểm tra nhiều tab dùng cùng tài khoản và hành vi khi Firebase thu hồi quyền lúc mất mạng |
| Vừa | Responsive, accessibility | Chromium ở 320 px xác nhận Mục tiêu hết tràn ngang. Kiểm tra bảy tuyến học chính, drawer đóng/mở bằng bàn phím, chuyển đến nội dung, focus của bộ lọc và kho đồ. Nút chính đạt tỉ lệ tương phản 4,5:1 trong kiểm thử | Mã trong repo. Chưa rà bằng trình đọc màn hình hoặc Safari | Kiểm tra thêm trình duyệt, zoom và thao tác chạm trên thiết bị thật |
| Vừa | Bàn phím cho chuông và banner | Chromium kiểm tra mở bằng Enter, Escape trả focus, giữ nút đóng khi Firestore trả bản cập nhật, đóng bảng khi đổi trang. Banner chỉ hiện ở Tổng quan, cập nhật được nội dung sửa và trả focus khi ẩn | CI và GitHub Pages đạt tại `ac98ea0` | Kiểm tra với trình đọc màn hình và Safari |
| Vừa | Kiểm thử đa trình duyệt | Bổ sung job Firefox và WebKit dùng cùng các bài kiểm tra bàn phím, thông báo, lưu cục bộ và mobile 320 px. Chromium tiếp tục chạy bộ đầy đủ. | Đang chờ kết quả CI. Firefox cục bộ không khởi tạo được hồ sơ, WebKit cục bộ thiếu thư viện | Kiểm tra Safari trên thiết bị Apple và trình đọc màn hình |
| Vừa | Rà tự động accessibility trên web | Dùng axe-core ở 390 px, phát hiện nhãn ô chọn Pomodoro và độ tương phản chữ trên Mục tiêu, Tổng quan và hộp đăng nhập. Đã sửa các vị trí trên. CI Firefox vòng đầu phát hiện tràn ngang 17 px ở 320 px, đã giới hạn phần tên thương hiệu và thêm log phần tử tràn | Chromium kiểm tra cục bộ | Đợi kết quả CI Firefox và WebKit của bản sửa, sau đó kiểm tra bằng trình đọc màn hình |
| Vừa | Hiệu năng và bảo trì | Tải Góc học, Mục tiêu, Nhìn lại và Quản lý khi mở trang tương ứng. Đo tải lạnh Tổng quan trên Chromium cục bộ, số tệp JS cùng origin giảm từ 58 còn 47, số byte sau giải nén giảm từ 375.193 còn 259.208. Kiểm thử import chậm khi người dùng đã đổi tuyến | GitHub Pages và CI đạt tại `79fee50`. Đã xác nhận mã tuyến tải theo nhu cầu có trên web thật. Chưa đo tốc độ trên thiết bị thật | Đo tải trên thiết bị và mạng thật |

- [CI của bản đối chiếu](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44519336478)
- [GitHub Pages của bản đối chiếu](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44519335661)
- [CI của bản sửa đồng bộ](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44520993014)
- [GitHub Pages của bản sửa đồng bộ](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44520992752)

Rules đã được gộp trong `firestore.rules`. Người dùng xác nhận đã Publish ngày 19/11/2026. Kiểm tra chỉ đọc trên Firestore thật trả 200 cho `universities`, `announcements`, `studyPresence` và `catalog`, trả 403 cho khách đọc `users`, `adminLogs` và `rewardTasks`. Các kết quả này xác minh hành vi công khai, chưa đối chiếu mã Rules đang hoạt động hoặc các quyền có đăng nhập. Worker thật phản hồi `/health` với `walletMigrationEnabled: false`. Sau bước cập nhật Worker, người dùng gửi ảnh Quản lý → Kết nối ví xác nhận đăng nhập quản trị và đọc Firestore thành công. Kiểm tra riêng trên endpoint thật nhận HTTP 401 khi gọi `/api/status` không đăng nhập. Endpoint `/health` hiện chưa có mã bản dựng, nên kết quả kiểm tra kết nối chỉ xác minh quyền đọc. Chưa xác minh giao dịch ghi trên tài khoản đã chuyển. Các điểm khác trong chính sách hiện hành, chẳng hạn hạn mức sau khi hủy thưởng, cần được người dùng duyệt trước khi kích hoạt. Chuyển ví thật và thay đổi thanh toán cần xác nhận riêng.

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

- [CI của công cụ chạy thử chuyển ví](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44529072046)

- [CI của kéo thả và chuyển môn](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44530050012)

- [CI của Cài đặt và sao lưu](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44530972055)

Worker chờ một khoảng tăng dần có độ lệch trước khi thử lại giao dịch Firestore bị tranh chấp. Workflow ưu tiên trình duyệt đã có trên runner và giữ bước cài đặt Playwright khi cần.

- [CI của cách ly dữ liệu tài khoản](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44532211049)

- [CI của bản Rules đầy đủ](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44537623463)

Ngày 19/11/2026, người dùng yêu cầu bỏ qua phần ví và tiếp tục cải thiện web. Các phép đo tải lạnh dùng localhost, Chromium và phụ thuộc mạng mô phỏng.

- [CI của tải trang theo nhu cầu](https://github.com/n2s96kd69k-ux/goc-hoc-nho/actions/runs/44540637499)

Đo thử Tổng quan trên web thật ở viewport 390 px bằng Chromium tại môi trường kiểm thử. Lần đo ghi nhận LCP 1.524 ms. Đây là một lần đo trong môi trường kiểm thử, chưa có số liệu thực địa trên thiết bị người dùng.
