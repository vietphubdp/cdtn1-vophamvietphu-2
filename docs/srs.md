# BẢN ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS RÚT GỌN)

**Hệ thống:** Smart CRM Mekong Mobile
**Luồng nghiệp vụ:** L2 – Tiếp nhận và phân loại yêu cầu bảo hành
**Sinh viên:** Võ Phạm Việt Phú · **MSSV:** 2374802010391 · **Track:** Công nghệ Phần mềm (SE)
**Học phần:** Chuyên đề tốt nghiệp 1

---

## 1. Giới thiệu và phạm vi

### 1.1. Bối cảnh

Mekong Mobile là chuỗi 24 cửa hàng và 6 trung tâm bảo hành, trung bình 260 phiếu bảo hành mỗi tháng. Phiếu hiện được ghi trên giấy, mỗi trung tâm lưu một cách, nên không ai biết phiếu đang ở bước nào (khoảng 15% phiếu quá hạn mà không được cảnh báo, vấn đề V2). Mô tả lỗi ghi tự do, không phân nhóm, nên không thống kê được nguyên nhân bảo hành (V8). Cuối ngày nhân viên tiếp nhận phải chép lại phiếu sang Excel, mất khoảng 40 phút.

### 1.2. Phạm vi

Tiếp nhận yêu cầu bảo hành: nhân viên tiếp nhận tra cứu khách theo số điện thoại, ghi nhận thiết bị, kiểm tra tình trạng bảo hành, chọn nhóm sự cố và mức ưu tiên để lập phiếu có mã và hạn cam kết; quản lý trung tâm theo dõi danh sách phiếu theo hạn cam kết.

### 1.3. Điều chủ ý KHÔNG làm (WON'T)

| Mã  | Nội dung không làm                                                             | Lý do                                                       |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| W1  | Phân công kỹ thuật viên, đặt lịch hẹn                                          | Thuộc luồng L4                                              |
| W2  | Đổi trạng thái phiếu sau MỚI và đóng phiếu                                     | Thuộc các luồng L4, L5                                      |
| W3  | Quản lý tồn kho, xuất linh kiện                                                | Thuộc luồng L5                                              |
| W4  | Khảo sát hài lòng sau bảo hành                                                 | Thuộc luồng L8                                              |
| W5  | Tự động phân loại nhóm sự cố (luật hoặc học máy)                               | Thuộc luồng L10; bản này nhân viên tự chọn nhóm từ danh mục |
| W6  | Báo cáo tổng hợp, dashboard toàn công ty                                       | Thuộc luồng L6                                              |
| W7  | Gộp hồ sơ khách hàng trùng                                                     | Thuộc luồng L1, L7                                          |
| W8  | Đính kèm ảnh, in phiếu, gửi tin nhắn cho khách; sửa, xóa khách hàng; hủy phiếu | Mức COULD, ghi vào hướng mở rộng                            |

### 1.4. Thuật ngữ

| Thuật ngữ           | Định nghĩa                                                                      | Tên kỹ thuật    |
| ------------------- | ------------------------------------------------------------------------------- | --------------- |
| Khách hàng          | Cá nhân đã mua sản phẩm hoặc dùng dịch vụ của Mekong Mobile                     | customer        |
| Thiết bị            | Một máy cụ thể của khách, xác định bằng serial/IMEI                             | device          |
| Phiếu bảo hành      | Một yêu cầu bảo hành hoặc sửa chữa, có mã duy nhất và vòng đời trạng thái       | ticket          |
| Trạng thái phiếu    | Vị trí của phiếu trong vòng đời; trong phạm vi L2 chỉ dùng trạng thái MỚI       | ticket_status   |
| Hạn cam kết         | Thời điểm chậm nhất phải hoàn tất phiếu, tính từ lúc tiếp nhận theo mức ưu tiên | due_date        |
| Nhóm sự cố          | Phân loại nguyên nhân: màn hình, pin, sạc, phần mềm, nước vào, khác             | issue_category  |
| Mức ưu tiên         | Cao, Trung bình, Thấp; quyết định hạn cam kết                                   | priority        |
| Tình trạng bảo hành | Còn bảo hành, hết bảo hành, hoặc chưa xác minh (thiếu ngày mua)                 | warranty_status |

---

## 2. Các bên liên quan và vai trò người dùng

| Vai trò             | Được làm                                                                                                                       |
| :------------------ | :----------------------------------------------------------------------------------------------------------------------------- |
| Nhân viên tiếp nhận | Tra cứu và tạo khách hàng, ghi nhận thiết bị, lập phiếu bảo hành, chọn nhóm sự cố và mức ưu tiên, xem phiếu của trung tâm mình |
| Quản lý trung tâm   | Xem toàn bộ phiếu của trung tâm mình, quyết định phiếu chưa xác minh bảo hành, xem số điện thoại đầy đủ                        |

---

## 3. Yêu cầu chức năng

### 3.1. Danh sách yêu cầu chức năng

| Mã   | Yêu cầu chức năng                                                                                                                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR1  | Hệ thống cho phép tra cứu khách hàng theo số điện thoại; số nhập vào được chuẩn hóa về 10 chữ số bắt đầu bằng 0 trước khi tra; nếu tìm thấy thì hiển thị hồ sơ khách.                                                 |
| FR2  | Hệ thống cho phép tạo khách hàng mới khi số điện thoại chưa tồn tại; họ tên và số điện thoại là bắt buộc, số điện thoại không được trùng.                                                                             |
| FR3  | Hệ thống hiển thị danh sách thiết bị của khách (tên máy, serial/IMEI, ngày mua) và cho chọn một thiết bị để lập phiếu.                                                                                                |
| FR4  | Hệ thống cho phép ghi nhận thiết bị mới cho khách; serial/IMEI bắt buộc và không được trùng, ngày mua được để trống.                                                                                                  |
| FR5  | Hệ thống xác định tình trạng bảo hành tại thời điểm tiếp nhận và hiển thị một trong ba kết quả: còn bảo hành, hết bảo hành, chưa xác minh (thiếu ngày mua).                                                           |
| FR6  | Hệ thống cho phép Quản lý trung tâm quyết định "miễn phí" hoặc "có tính phí" cho phiếu chưa xác minh, kèm lý do. _(COULD, chưa hiện thực)_                                                                            |
| FR7  | Hệ thống cho phép lập phiếu với các trường bắt buộc: khách hàng, thiết bị, trung tâm, mô tả lỗi; khi lưu thì sinh mã phiếu duy nhất, đặt trạng thái MỚI, ghi thời điểm tiếp nhận và dòng lịch sử trạng thái đầu tiên. |
| FR8  | Hệ thống cho phép chọn nhóm sự cố và mức ưu tiên; mức ưu tiên được điền sẵn theo mặc định của nhóm và nhân viên có thể đổi.                                                                                           |
| FR9  | Hệ thống tự sinh hạn cam kết từ thời điểm tiếp nhận: Cao 24 giờ, Trung bình 72 giờ, Thấp 120 giờ, không tính Chủ nhật.                                                                                                |
| FR10 | Hệ thống hiển thị danh sách phiếu của trung tâm mình, lọc theo trạng thái, tìm theo mã phiếu hoặc số điện thoại, sắp theo hạn cam kết và đánh dấu phiếu quá hạn.                                                      |

### 3.2. User Story và mức MoSCoW

| Mã  | User Story                                                                                                                                                                        | MoSCoW     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| US1 | **Là nhân viên tiếp nhận**, tôi muốn tra cứu khách bằng số điện thoại và xem danh sách thiết bị của khách để không phải hỏi lại tên, địa chỉ và máy khách đã mua.                 | **MUST**   |
| US2 | **Là nhân viên tiếp nhận**, tôi muốn tạo hồ sơ cho khách chưa có trong hệ thống ngay lúc tiếp nhận để không phải ghi tay rồi nhập bổ sung.                                        | **SHOULD** |
| US3 | **Là nhân viên tiếp nhận**, tôi muốn ghi nhận thiết bị chưa có trong hệ thống để vẫn tiếp nhận được máy mà không phải làm giấy riêng.                                             | **SHOULD** |
| US4 | **Là nhân viên tiếp nhận**, tôi muốn biết thiết bị còn hay hết bảo hành, hoặc chưa xác minh, để không phải lật sổ hay gọi cửa hàng tra ngày mua.                                  | **SHOULD** |
| US5 | **Là quản lý trung tâm**, tôi muốn quyết định các phiếu chưa xác minh bảo hành (miễn phí hay có tính phí, kèm lý do) để tránh tranh chấp do nhân viên tự ghi "còn bảo hành".      | **COULD**  |
| US6 | **Là nhân viên tiếp nhận**, tôi muốn lập phiếu bảo hành có mã duy nhất để mỗi yêu cầu đều được theo dõi và không còn phiếu giấy thất lạc.                                         | **MUST**   |
| US7 | **Là nhân viên tiếp nhận**, tôi muốn chọn nhóm sự cố và mức ưu tiên từ danh mục có sẵn để phân loại nhất quán giữa các nhân viên và thống kê được nguyên nhân phổ biến.           | **SHOULD** |
| US8 | **Là nhân viên tiếp nhận**, tôi muốn hệ thống tự sinh hạn cam kết để hẹn ngày trả máy có căn cứ thay vì ước lượng theo kinh nghiệm cá nhân.                                       | **MUST**   |
| US9 | **Là quản lý trung tâm**, tôi muốn xem danh sách phiếu sắp theo hạn cam kết, có đánh dấu quá hạn, để xử lý phiếu sắp trễ trước và nhân viên không phải chép sang Excel cuối ngày. | **SHOULD** |

### 3.3. Tiêu chí chấp nhận cho các story MUST

#### US1

- **AC1.** GIVEN số 0901234567 đã có trong hệ thống, WHEN nhân viên nhập số này (hoặc +84901234567), THEN hệ thống hiển thị đúng hồ sơ khách và danh sách thiết bị.
- **AC2 (ngoại lệ).** GIVEN số điện thoại chưa có trong hệ thống, WHEN nhân viên tra cứu, THEN hệ thống báo không tìm thấy và đề nghị tạo khách mới.
- **AC3 (ngoại lệ).** GIVEN số nhập vào không đủ 10 chữ số sau khi chuẩn hóa, WHEN nhân viên tra cứu, THEN hệ thống từ chối và nêu rõ lý do.

#### US6

- **AC1.** GIVEN khách, thiết bị, trung tâm và mô tả lỗi hợp lệ, WHEN nhân viên bấm Lưu phiếu, THEN phiếu được lưu với mã duy nhất, trạng thái MỚI, có thời điểm tiếp nhận và một dòng lịch sử trạng thái đầu tiên.
- **AC2 (ngoại lệ).** GIVEN mô tả lỗi để trống hoặc dưới 10 ký tự, WHEN bấm Lưu phiếu, THEN hệ thống từ chối, nêu rõ trường chưa hợp lệ và giữ nguyên dữ liệu đã nhập.
- **AC3 (ngoại lệ).** GIVEN thiết bị được chọn không thuộc khách đang tiếp nhận, WHEN bấm Lưu phiếu, THEN hệ thống từ chối và thông báo thiết bị không thuộc khách hàng này.

#### US8

- **AC1.** GIVEN phiếu mức CAO tiếp nhận lúc 09:00 thứ Hai, WHEN lưu phiếu, THEN hạn cam kết là 09:00 thứ Ba.
- **AC2.** GIVEN phiếu mức TRUNG_BINH tiếp nhận lúc 14:30 thứ Năm, WHEN lưu phiếu, THEN hạn cam kết là 14:30 thứ Hai tuần sau (bỏ qua Chủ nhật).
- **AC3 (ngoại lệ).** GIVEN phiếu mức CAO tiếp nhận lúc 10:00 thứ Bảy, WHEN lưu phiếu, THEN hạn cam kết là 10:00 thứ Hai, không rơi vào Chủ nhật.

---

## 4. Yêu cầu phi chức năng

| Mã   | Loại      | Yêu cầu (có ngưỡng đo được)                                                                                                                                              | Cách kiểm chứng                                        |
| :--- | :-------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| NFR1 | Hiệu năng | Trang đầu (20 dòng) của danh sách phiếu hiển thị dưới 2 giây với 10.000 phiếu; tra cứu khách theo số điện thoại dưới 1 giây với 65.000 hồ sơ                             | Nạp dữ liệu mẫu, đo thời gian phản hồi                 |
| NFR2 | Bảo mật   | Nhân viên tiếp nhận chỉ thấy số điện thoại khách ở dạng che 4 số (ví dụ 090\*\*\*\*567); chỉ Quản lý trung tâm thấy đầy đủ. Đúng ở 100% màn hình và 100% kết quả trả về. | Đăng nhập lần lượt hai vai trò, kiểm tra từng màn hình |
| NFR3 | Khả dụng  | Một nhân viên tiếp nhận mới, chưa được hướng dẫn, lập xong một phiếu bảo hành đúng trong dưới 3 phút.                                                                    | Cho 3 người thử, bấm giờ từng người                    |

---

## 5. Ràng buộc và quy tắc nghiệp vụ

| Mã    | Quy tắc                                                                                                                            | Liên quan  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| QT-01 | Số điện thoại khách là duy nhất; nhập số đã tồn tại thì hiển thị hồ sơ có sẵn, không tạo mới.                                      | FR1, FR2   |
| QT-02 | Số điện thoại được chuẩn hóa về 10 chữ số bắt đầu bằng 0 (chấp nhận +84…, 84…, dấu cách, dấu chấm).                                | FR1, FR2   |
| QT-03 | Thiết bị xác định duy nhất bằng serial/IMEI; một thiết bị chỉ thuộc một khách tại một thời điểm.                                   | FR4, FR7   |
| QT-04 | Hạn cam kết: Cao 24 giờ, Trung bình 72 giờ, Thấp 120 giờ; chỉ tính thứ Hai đến thứ Bảy.                                            | FR9        |
| QT-05 | Còn bảo hành nếu (ngày tiếp nhận − ngày mua) ≤ số tháng bảo hành; thiếu ngày mua thì "chưa xác minh bảo hành", cần quản lý duyệt.  | FR5, FR6   |
| QT-06 | Mọi lần chuyển trạng thái đều phải ghi vào lịch sử; trong phạm vi L2, phiếu mới tạo ở trạng thái MỚI và ghi dòng lịch sử đầu tiên. | FR7        |
| QT-13 | Không xóa vật lý phiếu, đơn hàng, hồ sơ khách; chỉ đánh dấu ngừng sử dụng.                                                         | Tất cả     |
| QT-14 | Nhân viên chỉ xem dữ liệu của trung tâm mình; quản lý xem toàn bộ đơn vị phụ trách.                                                | FR10, NFR2 |
| QT-15 | Số điện thoại hiển thị dạng che với mọi vai trò trừ Quản lý và Ban giám đốc.                                                       | NFR2       |

**Giả định của luồng:**

- Hạn cam kết cộng đủ số giờ theo mức ưu tiên và cộng thêm 24 giờ cho mỗi Chủ nhật đi qua.
- Phiếu hết bảo hành vẫn được lập và ghi là có tính phí.
- Nếu UC4 chưa hiện thực thì mọi phiếu mặc định ở tình trạng "chưa xác minh bảo hành".

---

## 6. Bảng truy vết yêu cầu

| Mã FR | Yêu cầu chức năng (rút gọn)                              | User Story | Use Case | MoSCoW |
| ----- | -------------------------------------------------------- | ---------- | -------- | ------ |
| FR1   | Tra cứu khách theo số điện thoại (có chuẩn hóa số)       | US1        | UC1      | MUST   |
| FR2   | Tạo khách mới khi số điện thoại chưa tồn tại             | US2        | UC2      | SHOULD |
| FR3   | Hiển thị danh sách thiết bị của khách và chọn thiết bị   | US1        | UC1      | MUST   |
| FR4   | Ghi nhận thiết bị mới chưa có trong danh sách            | US3        | UC3      | SHOULD |
| FR5   | Xác định tình trạng bảo hành (còn / hết / chưa xác minh) | US4        | UC4      | SHOULD |
| FR6   | Quản lý quyết định phiếu chưa xác minh bảo hành          | US5        | UC5      | COULD  |
| FR7   | Lập phiếu: sinh mã, trạng thái MỚI, ghi lịch sử đầu tiên | US6        | UC6      | MUST   |
| FR8   | Chọn nhóm sự cố và mức ưu tiên (có mặc định theo nhóm)   | US7        | UC6      | SHOULD |
| FR9   | Tự sinh hạn cam kết theo mức ưu tiên                     | US8        | UC6      | MUST   |
| FR10  | Danh sách phiếu theo hạn cam kết, đánh dấu quá hạn       | US9        | UC7      | SHOULD |

---

# PHỤ LỤC

## Phụ lục A. Use Case Diagram

### A.1. Chú thích ký hiệu

| Ký hiệu                          | Ý nghĩa                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Hình người                       | Actor: người tương tác với hệ thống                                                                               |
| Hình elip                        | Use case: một chức năng mà actor thực hiện, đặt tên dạng động từ + đối tượng                                      |
| Khung chữ nhật bao quanh         | Ranh giới hệ thống: mọi use case bên trong thuộc phạm vi L2                                                       |
| Đường liền nối actor và use case | Actor thực hiện use case đó                                                                                       |
| Mũi tên nét đứt `<<include>>`    | Use case gốc luôn gọi use case được include (bước bắt buộc); mũi tên đi từ use case gốc tới use case được include |
| Mũi tên nét đứt `<<extend>>`     | Use case mở rộng chỉ xảy ra khi có điều kiện; mũi tên đi từ use case mở rộng về use case gốc                      |

### A.2. Các actor

| Actor               | Vai trò trong sơ đồ                                                          | Use case thực hiện      |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| Nhân viên tiếp nhận | Tiếp nhận yêu cầu tại trung tâm bảo hành, là người dùng chính                | UC1, UC2, UC3, UC4, UC6 |
| Quản lý trung tâm   | Giám sát phiếu của trung tâm mình và quyết định phiếu chưa xác minh bảo hành | UC5, UC7                |

### A.3. Các use case

| Mã  | Tên use case                            | Mô tả ngắn                                                                       | User Story    | Ưu tiên |
| --- | --------------------------------------- | -------------------------------------------------------------------------------- | ------------- | ------- |
| UC1 | Tra cứu khách hàng theo số điện thoại   | Tìm khách theo số điện thoại đã chuẩn hóa, hiển thị hồ sơ và thiết bị            | US1           | MUST    |
| UC2 | Tạo khách hàng mới                      | Tạo hồ sơ khi số điện thoại chưa tồn tại                                         | US2           | SHOULD  |
| UC3 | Ghi nhận thiết bị mới                   | Thêm thiết bị (bắt buộc serial/IMEI) khi chưa có trong danh sách của khách       | US3           | SHOULD  |
| UC4 | Kiểm tra tình trạng bảo hành            | Xác định còn bảo hành, hết bảo hành hoặc chưa xác minh                           | US4           | SHOULD  |
| UC5 | Quyết định phiếu chưa xác minh bảo hành | Quản lý chọn miễn phí hoặc có tính phí, kèm lý do                                | US5           | COULD   |
| UC6 | Lập phiếu bảo hành                      | Ghi nhận phiếu mới, chọn nhóm sự cố và mức ưu tiên, sinh mã phiếu và hạn cam kết | US6, US7, US8 | MUST    |
| UC7 | Xem danh sách phiếu                     | Xem phiếu của trung tâm sắp theo hạn cam kết, đánh dấu quá hạn                   | US9           | SHOULD  |

### A.4. Quan hệ giữa các use case

- UC6 `<<include>>` UC1: lập phiếu luôn bắt đầu bằng việc tra cứu khách.
- UC6 `<<include>>` UC4: mỗi phiếu đều phải xác định tình trạng bảo hành.
- UC2 `<<extend>>` UC6: chỉ xảy ra khi khách chưa tồn tại trong hệ thống.
- UC3 `<<extend>>` UC6: chỉ xảy ra khi thiết bị chưa có trong danh sách của khách.

---

## Phụ lục B. Đặc tả use case UC6 – Lập phiếu bảo hành

### B.1. Thông tin chung

- **Actor chính:** Nhân viên tiếp nhận
- **Mục tiêu:** Ghi nhận một yêu cầu bảo hành vào hệ thống để theo dõi đến khi đóng.
- **Điều kiện trước:** Nhân viên đã đăng nhập, có quyền tiếp nhận và thuộc một trung tâm bảo hành.
- **Điều kiện sau:** Một phiếu ở trạng thái MỚI được lưu, có mã phiếu duy nhất, hạn cam kết và một dòng lịch sử trạng thái đầu tiên.
- **Liên quan:** US6, US7, US8 (include UC1, UC4) | **Mức ưu tiên:** MUST

### B.2. Luồng chính

1. Nhân viên chọn chức năng "Tạo phiếu bảo hành mới".
2. Nhân viên nhập số điện thoại khách.
3. Hệ thống chuẩn hóa số, tra cứu và hiển thị thông tin khách cùng danh sách thiết bị. _[include UC1]_
4. Nhân viên chọn thiết bị cần bảo hành.
5. Hệ thống xác định tình trạng bảo hành và hiển thị kết quả: còn bảo hành, hết bảo hành, hoặc chưa xác minh. _[include UC4]_
6. Nhân viên nhập mô tả lỗi.
7. Nhân viên chọn nhóm sự cố; hệ thống điền sẵn mức ưu tiên mặc định của nhóm; nhân viên xác nhận hoặc đổi mức ưu tiên.
8. Nhân viên bấm Lưu phiếu.
9. Hệ thống kiểm tra dữ liệu, sinh mã phiếu, sinh hạn cam kết theo mức ưu tiên, lưu phiếu ở trạng thái MỚI, ghi lịch sử trạng thái và hiển thị mã phiếu cùng hạn cam kết.

### B.3. Luồng ngoại lệ

- **3a. Khách chưa tồn tại.** Hệ thống mở form tạo khách mới với số điện thoại đã điền sẵn _[extend UC2]_; sau khi lưu khách, quay lại bước 4.
- **3b. Số điện thoại không hợp lệ** (không đủ 10 chữ số sau khi chuẩn hóa). Hệ thống từ chối, nêu rõ lý do, cho nhập lại.
- **4a. Thiết bị chưa có trong danh sách của khách.** Cho nhập thiết bị mới, bắt buộc có serial/IMEI _[extend UC3]_. Nếu serial đã thuộc khách khác, hệ thống từ chối (QT-03).
- **5a. Thiếu ngày mua.** Hệ thống hiển thị "chưa xác minh bảo hành", vẫn cho lập phiếu và đánh dấu phiếu chờ Quản lý trung tâm quyết định _[UC5]_. Đây là cách xử lý có kiểm soát cho "đường tránh" ở bước 4 của Mục 6.1 trong tài liệu case study.
- **5b. Hết bảo hành.** Hệ thống hiển thị cảnh báo; nhân viên vẫn lập phiếu được, phiếu được ghi là có tính phí.
- **6a. Mô tả lỗi để trống hoặc dưới 10 ký tự.** Hệ thống từ chối lưu, nêu rõ trường chưa hợp lệ, giữ nguyên dữ liệu đã nhập.
- **9a. Mất kết nối khi đang lưu.** Hệ thống giữ dữ liệu trên giao diện, cho thử lưu lại và không tạo phiếu trùng.

---

<!-- ## Phụ lục C. Mẫu đặc tả riêng của track SE: Hợp đồng API -->

---

## Phụ lục C. Khai báo sử dụng công cụ AI

| Công cụ | Dùng vào việc gì                                                              | Áp dụng ở phần nào         | Đã kiểm chứng thế nào                                             |
| ------- | ----------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| Gemini  | Gợi ý bản nháp User Story, tiêu chí chấp nhận, danh sách use case, đặc tả UC6 | Mục 3.2, 3.3; Phụ lục A, B | Đối chiếu từng story với Mục 4 case study, sửa phạm vi và MoSCoW  |
| Gemini  | Gợi ý bản nháp yêu cầu chức năng, yêu cầu phi chức năng, quy tắc nghiệp vụ    | Mục 3.1, 4, 5              | Đối chiếu QT-01 đến QT-15 trong case study, điều chỉnh ngưỡng NFR |
| Gemini  | Soạn khung hợp đồng API                                                       | Phụ lục C                  | Đối chiếu từng endpoint với User Story và ERD                     |

---
