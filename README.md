# Chat Translator

Extension Chrome độc lập để dịch tin nhắn trên LinkedIn, WhatsApp Web, Messenger (Facebook / messenger.com), Zalo Web, Telegram Web (A/K), Teams và Discord bằng OpenAI API key của bạn. Dùng cùng cơ chế xem trước và Tab của chat khi soạn bình luận hoặc trả lời bình luận LinkedIn.

## Cài đặt / cập nhật

1. Mở `chrome://extensions`, bật **Developer mode**.
2. Chọn **Load unpacked** và trỏ tới thư mục `extension/`. Nếu đã cài, bấm **Reload** ở thẻ extension sau khi cập nhật file.
3. Mở popup, nhập OpenAI API key và bấm **Lưu cài đặt**.
4. Tải lại các tab đang mở để nạp phiên bản mới **1.3.10**, nhận diện chat nổi LinkedIn cả khi nằm trong Shadow DOM mở/đóng/lồng nhau. Popup hiển thị phiên bản đang chạy trong tab, nhắc tải lại khi tab vẫn dùng mã cũ và báo rõ khi chưa kết nối tab. Giữ tính năng soạn bình luận và system prompt tuyển dụng đã có. Các phiên bản từ 1.3.0 bổ sung quyền truy cập các miền chat mới; nếu Chrome hỏi cấp quyền cho extension, bật quyền trên các trang bạn muốn dùng.

## Cách sử dụng

- **Tin đã gửi và nhận:** dùng chung ngôn ngữ **Tiếng Việt** hoặc **Tiếng Anh** cho các tin trong hội thoại. Tin chat mới đến và tin vừa gửi tự hiển thị bản dịch bên dưới; công tắc điều khiển tự dịch cả hai loại tin trên mọi nền tảng. Ngôn ngữ này độc lập với ngôn ngữ bản nháp Anh/Hàn/Nhật.
- **Chat nổi LinkedIn:** dùng cùng cơ chế dịch trên trang feed: tin mới tự dịch; gõ trong ô “Viết tin nhắn…” để xem trước phía trên, nhấn **Tab** để thay bản nháp, rồi tự bấm gửi. Theo dõi riêng từng cửa sổ chat, kể cả vùng Shadow DOM, và giữ tin cũ ở chế độ bấm dịch. Các fallback giao diện mới được kiểm tra bằng dữ liệu mô phỏng trên Chrome; cần đối chiếu thêm trên tài khoản LinkedIn thực tế.
- **Soạn bình luận LinkedIn:** bật **Khi bạn soạn**, chọn ngôn ngữ đích, lưu cài đặt rồi gõ trong ô bình luận hoặc Reply. Khi bản dịch hiện phía trên ô soạn, nhấn **Tab** để thay văn bản. Bạn tự bấm đăng bình luận. Extension không thêm nút dịch vào bài viết/bình luận đã đăng và không dịch ô tạo bài viết; phạm vi này được thu gọn theo yêu cầu người dùng ở 1.3.8.
- **Tin nhắn cũ:** có nút **Dịch tin này** bên dưới. Không tự gọi API khi reload, bật lại extension, đổi ngôn ngữ, mở hội thoại hoặc cuộn tải lịch sử. Tin nhắn được nhận diện bằng thời điểm tạo, ID và vị trí trong hội thoại; khi không có đủ bằng chứng là tin mới, extension để bạn bấm dịch.
  Khi mới mở hội thoại, extension chờ lịch sử ngừng tải khoảng 900 ms. Tin thiếu mốc thời gian và xuất hiện trong giai đoạn này được giữ ở chế độ bấm dịch để tránh tốn token vì lịch sử tải chậm. Tin có thời điểm tạo mới vẫn có thể tự dịch trong giai đoạn khởi tạo.
- **Dịch lại tất cả:** nút trong popup sẽ lưu các cài đặt bạn đang chọn và dịch lại các tin nhận và tin gửi **đã tải trong tab chat đang mở**, theo ngôn ngữ ở mục **Tin đã gửi và nhận**. Không tự cuộn hoặc tải toàn bộ lịch sử từ nền tảng. Thao tác này chủ động yêu cầu bản dịch mới, có thể tốn token; dùng nút dưới từng tin nếu chỉ cần một tin. Bạn vẫn có thể dịch thủ công khi tắt công tắc tự dịch tin trong hội thoại.
- **Khi bạn soạn:** gõ trực tiếp trong ô chat, bình luận hoặc trả lời bình luận LinkedIn. Sau khi ngừng gõ khoảng **550 ms**, extension yêu cầu bản dịch và hiện kết quả phía trên ô soạn. Ngôn ngữ nguồn được nhận diện tự động; mục này có ngôn ngữ đích riêng (mặc định Tiếng Anh), chỉ dùng cho bản nháp. Đổi ngôn ngữ hoặc tắt bản xem trước không đổi kết quả dịch tin đã gửi/nhận. Các bản nháp bình luận có sẵn nhưng chưa được focus không tự gửi tới API.
- Nhấn **Tab** khi bản dịch hiện sẵn để thay nội dung ô chat/bình luận. Bản gốc giữ nguyên trước khi nhấn Tab. Bạn tự gửi tin/đăng bình luận bằng thao tác bình thường của trang; Tab chỉ thay văn bản. Có thể dùng **Ctrl+Z** trong ô soạn để hoàn tác.
- Tab giữ hành vi chuyển focus thông thường khi chưa có bản dịch hoặc đang gõ bằng IME. **Shift+Tab** luôn giữ hành vi thông thường.
- Trên ô soạn rich text như WhatsApp, extension xác nhận văn bản sau khi trình soạn cập nhật, bỏ qua ký tự bố cục và đoạn trống ở cuối. Nếu thao tác nhập gốc bị từ chối, extension thử handler `beforeinput` của trang; không ghi trực tiếp HTML làm lệch dữ liệu của ô soạn.
- Bật/tắt riêng dịch tin trong hội thoại và dịch khi gõ, hoặc dùng công tắc tổng để tạm dừng. Bấm **Lưu cài đặt** để áp dụng ngay trong tab đang mở, không cần tải lại tab cho các thay đổi cài đặt.
- Khi API lỗi, thông báo hiện ngay tại chỗ cùng nút **Thử lại**. Extension không tự thay văn bản bằng kết quả lỗi hay kết quả của bản nháp cũ.
- Khi popup báo không nhận diện được tin nào, nút **Kiểm tra nhận diện** cho phép chọn phần chữ một tin trong trang. Báo cáo chỉ chứa phiên bản mã đang chạy, bộ đếm, trạng thái bật/tắt và cấu trúc thẻ/class/component; không lấy nội dung tin, API key, ID, URL hay HTML. Nhấn **Ctrl+C** để sao chép báo cáo đã chọn, **Esc** hoặc **Đóng** để bỏ. Thao tác chẩn đoán không yêu cầu bản dịch, không gửi báo cáo ra mạng hoặc lưu xuống ổ đĩa.

## Dữ liệu và API

Khi tự dịch bật và đã có key, nội dung tin mới đến, tin vừa gửi và bản nháp chat/bình luận bạn gõ được tự động gửi tới OpenAI theo công tắc của mục tương ứng. Tin cũ trong hội thoại chỉ được gửi khi bạn bấm dịch. Có phí API theo mức sử dụng; tốc độ dịch phụ thuộc mạng và phản hồi API. Dùng công tắc để tạm dừng khi cần.

API key lưu trong `chrome.storage.local` của hồ sơ Chrome. Để trống ô key khi lưu sẽ giữ key cũ; **Xóa key** sẽ dừng dịch đến khi có key mới. Bản 1.3.4 giữ các cài đặt đã lưu: ngôn ngữ tin đến cũ trở thành ngôn ngữ đọc cả tin gửi/nhận, ngôn ngữ tin đi cũ trở thành ngôn ngữ bản nháp. Không tự dịch lại lịch sử khi cập nhật.

Extension chỉ giữ cache bản dịch trong bộ nhớ tạm của service worker, tối đa 150 kết quả trong 5 phút; không lưu lịch sử chat xuống ổ đĩa. Yêu cầu giống nhau được dùng chung; tối đa hai yêu cầu API chạy đồng thời, ưu tiên bản nháp. Không cần CRM hay server local.

System prompt nằm ở `getTranslationPrompt(targetLang)` trong `background/service-worker.js`, hiện dùng nội dung người dùng cung cấp cho hội thoại tuyển dụng TA/candidate. Tin đã gửi/nhận và bản nháp dùng chung prompt, với ngôn ngữ đích riêng theo cài đặt. Khi sửa prompt, giữ nội suy ngôn ngữ và JSON `translatedText`/`detectedLanguage`, rồi Reload extension và tải lại tab chat.

## Kiểm thử

Bản 1.3.10 tái hiện lỗi 0 tin/0 ô soạn của bản trước khi cửa sổ chat nằm trong Shadow DOM. Kiểm tra root mở/đóng, ô soạn trong root lồng, root gắn sau lúc trang tải, gõ ngay khi mở chat, theo dõi tin nhận/gửi mới, preview, Tab và Undo. Kiểm tra giao diện trên trang bật Trusted Types, chẩn đoán chọn đúng phần chữ trong root đóng và không đưa nội dung tin/key vào báo cáo; popup phân biệt tab cũ với mất kết nối.

`extension.test.cjs` nạp extension MV3 thật vào một hồ sơ Chrome tạm riêng qua `Extensions.loadUnpacked`, dùng `chrome.dom` và runtime/storage thật để kiểm tra root đóng, API dịch, Tab/Undo và báo cáo chẩn đoán. Trang chat và phản hồi API đều tổng hợp; không mở tài khoản LinkedIn hoặc gọi OpenAI thật. Kiểm thử này yêu cầu Chrome hỗ trợ phương thức DevTools đó; đã chạy trên Chrome 154.

Bản 1.3.9 bổ sung 10 kịch bản chat nổi trên feed LinkedIn: shell cũ với composer mới, dialog có class hash, panel có transcript cuộn, editor không nhãn với nút Gửi, CSS pre-wrap thừa kế, nhiều paragraph trong một tin, hội thoại mở muộn/rỗng, nhiều cửa sổ có/không có tiêu đề và hook thêm sau khi mount. Kiểm tra tin cũ không tự dịch, tin mới nhận/gửi tự dịch, preview/Tab không gửi tin, giữ nhiều dòng và mốc lịch sử khi prepend/remount, không dịch feed/tìm kiếm/metadata/trích dẫn/ảnh không có chữ.

Bản 1.3.8 kiểm thử soạn comment/reply bằng Quill, textarea, nhãn semantic, placeholder Việt/Anh, editor class hash trong feed, permalink và contenteditable rỗng/plaintext-only. Kiểm tra ô xuất hiện khi focus/Reply, handler beforeinput có kiểm soát, Tab không submit, Undo, placeholder thêm muộn và bản nháp chưa focus không gọi API. Feed đã đăng, ô tạo bài viết, tìm kiếm và profile không được dịch; chat nổi vẫn tự dịch tin mới. Popup hiển thị số ô soạn và không báo lỗi thiếu lịch sử chat trên trang chỉ có bình luận. Các kiểm thử dùng DOM/API mô phỏng, chưa phải kiểm tra trên tài khoản LinkedIn thật.

Kiểm thử chỉ dùng dữ liệu tổng hợp và API giả lập, không dùng tài khoản chat hay API key thật.

```powershell
node --test extension/tests/background.test.cjs
node --test extension/tests/browser.test.cjs
node --test extension/tests/extension.test.cjs
```

Kiểm thử trình duyệt cần `@playwright/test` trong môi trường phát triển và Google Chrome cài sẵn. Ảnh popup kiểm tra giao diện được tạo tại `extension/tests/artifacts/popup.png`.

Các bài kiểm thử trình duyệt dùng DOM mô phỏng của các nền tảng, bao gồm các dạng nội dung tin của LinkedIn, hai bản Telegram Web và nội dung Zalo dùng thẻ `span-15`/`div-15` trong `.text-message__container` hoặc `.card` không có class `card--text`. Bản 1.3.3 nhận diện thêm `[data-component="message-text-content"]` và `[data-component="text-container"]` theo cấu trúc phần chữ người dùng cung cấp; không yêu cầu phần chữ phải nằm trong `.card`. Dùng ID `mtc-*` trên text-container để giữ danh tính khi render lại. Với cấu trúc component mới, ô soạn xác định phạm vi hội thoại ổn định ngay cả khi danh sách trống hoặc class danh sách thay đổi. Từ 1.3.4 mọi bubble dùng chung ngôn ngữ/công tắc đọc, không phân loại người gửi để chọn ngôn ngữ. Kiểm thử tách cài đặt đọc Việt/Anh khỏi bản nháp Nhật/Hàn, bao gồm manual, bulk, tin mới và cài đặt bản nháp đổi trong lúc tin đang chờ kết quả. Khung cũ `#messageViewContainer`, `#messageView`, `.message-view` vẫn được hỗ trợ; ID thành phần giao diện `div_*` không được dùng làm ID tin nhắn. Kiểm thử giữ nguyên dòng, emoji, loại tên người gửi, giờ, reaction, trích dẫn và nhãn file khỏi nội dung dịch; mỗi bubble chỉ có một bản dịch. Bao gồm tin vừa gửi, hai công tắc độc lập, danh sách chat bị dựng lại, timestamp chính xác đến giây, trạng thái online thay đổi và ô soạn rich text từ chối thao tác nhập gốc. Chưa kiểm tra trên các tài khoản đăng nhập thật. Giao diện nền tảng có thể thay đổi; bộ đếm và báo cáo kiểm tra trong popup giúp xác định cấu trúc còn bị bỏ sót.

Một số dấu hiệu DOM được đối chiếu với mã nguồn trực tiếp: [nội dung tin LinkedIn](https://gist.github.com/NormanPerrin/423756017257542ab257acfcc10cc0c3), [nội dung tin Teams](https://gist.github.com/skylord123/10c09eb8a4cf8b1244de6b13e07d4c67), [khung Messenger trên Facebook](https://gist.github.com/s-zeid/4502b4dd5f43f30fc30985a14b2b19f7), [thẻ tin Zalo cũ](https://gist.github.com/thienandangthanh/d04eddd99ba17bdb537dca9fddbf4c32), [text Zalo qua tích hợp ZaDark](https://github.com/ncdai/zadark/blob/main/src/core/js/zadark-translate.js) và [custom tag Zalo trong stylesheet ZaDark](https://github.com/ncdai/zadark/blob/main/src/core/scss/zadark.scss). Các selector mở rộng là phần tương thích cần kiểm tra trên tài khoản thực tế, không phải API chính thức của nền tảng.

Bản 1.3.5 mở rộng riêng Facebook Messages/Messenger: `messages_table` có thể nằm ở gridcell trong từng hàng tin, nên không yêu cầu nó bao ngoài danh sách. Nhận diện cả grid không có aria-label và ô soạn Lexical không phụ thuộc nhãn Việt/Anh. Dùng khung hội thoại làm mốc ổn định thay vì gridcell của mỗi tin; chọn toàn bộ thân tin để giữ inline span, emoji và xuống dòng. Nếu thiếu hook danh sách/hàng, fallback chỉ nhận `.html-div[dir=auto]` có định dạng `white-space: pre-wrap` trong khung chat. Loại sidebar, header, trạng thái, tên người gửi dạng link, giờ và nút thao tác; bình luận/bài đăng trong feed không được nhận thành ô soạn chat. Kiểm thử bao gồm cả hai miền, hội thoại trống, chat nổi trên Facebook và việc grid xuất hiện/mất đi mà không dịch lại lịch sử. Dấu hiệu scope/composer/dir được đối chiếu với [adapter Messenger của Ekko](https://github.com/useekko/ekko-core/blob/main/src/content/messenger.ts), vị trí marker trong từng hàng với [nghiên cứu selector Messenger 2026](https://github.com/Elffrynas/shoot-the-messenger-2026-fix). Các kiểm thử vẫn dùng DOM mô phỏng; chưa xác minh trên tài khoản đăng nhập thật.

Phần kiểm tra kết quả JSON của API tham khảo [tài liệu OpenAI chính thức](https://developers.openai.com/api/docs/guides/structured-outputs).
