# SmartHR — Module 1: Cổng Ứng viên (Candidate Portal) — Bản demo

Phạm vi: **UC1.1** Xem tin tuyển dụng · **UC1.2** Nộp hồ sơ ứng tuyển · **UC1.3** Theo dõi trạng thái hồ sơ.
Code được đặt tên **đúng theo sơ đồ lớp phân tích (BCE)** trong tài liệu `module_1.docx`.

| Lớp | Công nghệ |
|---|---|
| Frontend | React 18 + Vite + React Router, CSS thuần (nền sáng) |
| Backend | Node.js + Express, Multer (upload CV) |
| Database | SQLite (`better-sqlite3`) |
| Workspace | npm workspaces: `@smarthr/candidate-portal-api` (backend), `@smarthr/candidate-portal-web` (frontend) |

## 1. Chạy dự án (từ thư mục gốc)

```bash
npm install          # cài cho cả backend + frontend
npm run seed         # tạo dữ liệu giả lập (chạy lại được bất kỳ lúc nào để reset)
npm run dev          # chạy đồng thời API :3001 và Web :5173  → mở http://localhost:5173
```

Backend đã có sẵn `backend/.env` (copy từ `.env.example`). Chế độ AI chọn bằng `AI_MODE` (xem mục 4):
`mock` (mặc định, chạy offline) · `gemini` (gọi AI thật, cần `AI_API_KEY`) · `fail` (giả lập AI hỏng để demo dự phòng).

Kiểm thử tự động (AI Engine giả, không cần mạng): `npm test -w @smarthr/candidate-portal-api`

**Dữ liệu demo** (tra cứu bằng mã hồ sơ + email *hoặc* số điện thoại):

| Mã hồ sơ | Email | SĐT | Trạng thái công khai |
|---|---|---|---|
| APP-2026-0001 | an.mock@example.com | 0900000001 | RECEIVED |
| APP-2026-0002 | binh.mock@example.com | 0900000002 | UNDER_REVIEW |
| APP-2026-0003 | cuong.mock@example.com | 0900000003 | INTERVIEWING |
| APP-2026-0004 | dung.mock@example.com | 0900000004 | RESULT_AVAILABLE |

Tin để thử các nhánh đặc biệt: `/jobs/JOB-QA-004` (đã đóng — luồng 6A1), `JOB-DA-005` (còn OPEN nhưng quá hạn nộp, hiện trong danh sách), `JOB-DRAFT-006` (nháp — không công khai, trả 404).

## 2. Ánh xạ sơ đồ lớp phân tích → code

| Lớp trong tài liệu | File | Ghi chú |
|---|---|---|
| **Boundary** JobListingUI | `frontend/src/ui/JobListingUI.jsx` | Danh sách (`/`) + chi tiết JD (`/jobs/:jobCode`), khóa nút Ứng tuyển nếu tin đóng |
| JobApplicationUI | `frontend/src/ui/JobApplicationUI.jsx` | Form, chọn/đổi CV, thông báo thành công + mã hồ sơ |
| ApplicationTrackingUI | `frontend/src/ui/ApplicationTrackingUI.jsx` | Nhập mã + xác thực, thanh tiến độ |
| **Control** JobCatalogController | `backend/src/controls/JobCatalogController.js` | `getOpenJobPostings`, `getJobPostingDetail`, `checkJobOpenStatus`, `verifyApplicationDeadline` |
| JobApplicationController | `backend/src/controls/JobApplicationController.js` | `validateCandidateFields`, `validateCVFileFormatAndSize`, `verifyCVMagicBytes`, `checkDuplicateApplication`, `saveApplicationAndCV`, `sendCVToAIEngine`, `handleAIFallbackResult` (+ `submitApplication` điều phối) |
| ApplicationTrackingController | `backend/src/controls/ApplicationTrackingController.js` | `validateTrackingInput`, `verifyCandidateOwnership`, `getApplicationByCode`, `maskPublicStatus` (+ `trackApplication` điều phối) |
| **Entity** JobPosting (M3) | `backend/src/entities/JobPosting.js` | **Chỉ có hàm đọc** (tuân thủ G1) |
| Candidate / Application / CVDocument / AIScreening | `backend/src/entities/*.js` | Thuộc tính camelCase giống hệt tài liệu; cột DB cũng đặt tên như vậy (`db/schema.sql`) |
| **Actor** AI Engine | `backend/src/gateways/AIEngineGateway.js` | Gọi AI (Vertex AI/Gemini), kiểm tra dữ liệu trả về (`utils/aiResultValidator.js`), dữ liệu dự phòng `FALLBACK_RESULT` (NFR1.6) |
| (lưu trữ CV — S3) | `backend/src/gateways/S3StorageGateway.js` | Demo ghi ra đĩa `backend/uploads/cv`; thay bằng S3 sau |

Luồng gọi: `UI (React) → routes/index.js (HTTP mỏng) → controls/*Controller → entities/* → SQLite`; gateway chỉ được Control gọi.

## 3. API (đề xuất — tài liệu chưa có contract chính thức)

| UC | API | Control xử lý |
|---|---|---|
| UC1.1 | `GET /api/job-postings?q=` · `GET /api/job-postings/:jobCode` | JobCatalogController |
| UC1.2 | `POST /api/applications` (multipart: `jobPostingId, fullName, email, phone, coverLetter, cv`) | JobApplicationController |
| UC1.3 | `POST /api/applications/track` `{applicationCode, contactInfo}` | ApplicationTrackingController |
| UC1.2 (nội bộ) | `GET/POST /api/internal/applications/:applicationCode/ai-screening[/retry]` | JobApplicationController (`getAIScreeningResult`, `retryAIScreening`) |

## 4. AI Engine (UC1.2 bước 6–8) và nguyên tắc Human-in-the-loop

**Luồng:** lưu hồ sơ (kèm bản ghi `AIScreening = PENDING`) → gửi CV + JD tới AI → AI trả `matchScore, skills, experience, education` → kiểm tra hợp lệ → lưu (FR1.7).

| Tình huống | Xử lý | `AIScreening.status` |
|---|---|---|
| AI trả đủ 3 nhóm thông tin | Lưu kết quả | `SUCCESS` |
| AI thiếu một nhóm (vd. học vấn rỗng) | Lưu phần có được | `PARTIAL` |
| **8A1** AI không khả dụng (timeout, mất mạng, HTTP 5xx/429) | Hồ sơ vẫn nhận; dùng dữ liệu dự phòng rỗng, `isFallbackMock = 1`; **chạy lại sau** được | `FALLBACK_MOCK` |
| **9E1** AI trả lỗi / JSON hỏng / điểm ngoài 0–100 | Ghi lỗi vào `errorMessage`, **không dùng** dữ liệu AI, chuyển dự phòng | `FALLBACK_MOCK` |

**Đảm bảo BR1.2 / BR1.6:** AI Gateway chỉ nhận CV + JD và trả dữ liệu; không code nào của AI chạm tới `Application.internalStatus/publicStatus` (có test kiểm chứng). Ứng viên **không** thấy điểm/dữ liệu AI. Prompt yêu cầu AI không quyết định tuyển/loại và bỏ qua chỉ dẫn nằm trong CV (chống prompt injection).

**API nội bộ cho HR/module khác** (cần header `x-service-key` = `INTERNAL_SERVICE_KEY`, chỗ giữ chỗ cho RBAC):
- `GET  /api/internal/applications/:applicationCode/ai-screening` — "thông tin CV đã trích xuất" + lời nhắc *kết quả chỉ mang tính tham khảo, HR quyết định*.
- `POST /api/internal/applications/:applicationCode/ai-screening/retry` — chạy lại AI cho hồ sơ `PENDING/FALLBACK_MOCK` (luồng 8A1).

Màn hình `/demo/ai-result` mô phỏng HR xem kết quả (chỉ để demo, **không có nút đổi trạng thái hồ sơ**).

**Bật AI thật (Gemini Developer API — khuyên dùng để demo):** tạo key tại <https://aistudio.google.com/apikey> (key mới hiện nay bắt đầu bằng `AQ.`, **vẫn dùng được** với endpoint này) rồi đặt trong `backend/.env`:

```dotenv
AI_MODE=gemini
AI_API_KEY=<key của bạn>
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
AI_MODEL=gemini-flash-latest
```

**Luôn chạy `npm run ai:check -w @smarthr/candidate-portal-api` trước** (hoặc `npm run ai:check` trong thư mục `backend`): lệnh này liệt kê model mà *key của bạn* dùng được và gọi thử một câu, báo thẳng lỗi nếu có. Nếu thấy `✔ Thành công` thì hệ thống sẽ phân tích CV thật.

- Gateway nhận diện endpoint qua `AI_BASE_URL`: có chứa `aiplatform` → Vertex AI (cần Billing, đường dẫn `/publishers/google/models/...`); còn lại → Gemini Developer API (`/models/...`).
- PDF gửi trực tiếp cho AI; DOCX được trích văn bản trước. NFR1.1: chỉ dùng CV giả lập khi gọi AI thật.
- ⚠ `AI_MODE` chỉ nhận `mock | gemini | fail`; giá trị khác (vd. `groq`) sẽ báo lỗi `AI_NOT_CONFIGURED`, **không** âm thầm dùng mock. Chưa hỗ trợ Groq/OpenAI.
- ⚠ Không commit/chia sẻ key; key đã dán ở nơi công khai/chat nên tạo lại.

**Lỗi thường gặp** (nguyên nhân được ghi vào `AIScreening.errorMessage`, xem ở `/demo/ai-result`):

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| `AI_MODEL_NOT_FOUND` (HTTP 404) | Tên model sai hoặc Google đã ngừng cấp phát (model đời cũ như `gemini-2.0-flash`, `gemini-2.5-flash` có thể bị 404) | `npm run ai:check` → chọn model trong danh sách, hoặc `AI_MODEL=gemini-flash-latest` |
| `AI_AUTH_FAILED` ... *"has not been used in project"* | Dùng Vertex AI mà API chưa bật | Mở link trong lỗi → Enable; hoặc chuyển sang Gemini Developer API như trên |
| `AI_AUTH_FAILED` ... *"API key not valid"* | Key sai/thiếu ký tự | Kiểm tra `AI_API_KEY` |
| `AI_AUTH_FAILED` nhắc *billing* | Vertex AI cần bật thanh toán | Dùng Gemini Developer API (Free Tier) |
| `AI_UNAVAILABLE` (429/5xx/timeout) | Hết hạn mức Free Tier hoặc AI quá tải — luồng 8A1, hồ sơ vẫn lưu | Chờ rồi bấm "Chạy lại phân tích AI" |

## 5. Luồng UC1.2 (`submitApplication`)

kiểm tra trường bắt buộc → tin còn **OPEN** và **trong hạn** (BR1.1) → CV: đuôi PDF/DOCX, ≤ 10 MB, **magic bytes** (FR1.4) → chống trùng (BR1.3) →
lưu CV + 1 transaction ghi Candidate/Application/CVDocument/AIScreening(PENDING) (kiểm tra lại tin còn mở trong transaction — ngoại lệ 11E1) →
gửi AI và lưu kết quả; lỗi/timeout → `FALLBACK_MOCK`, **hồ sơ vẫn hợp lệ** (luồng 8A1/9E1) → trả `applicationCode` (VD `APP-2026-0005`).

## 6. Đã cài sẵn các quy tắc

- Ứng viên chỉ thấy `publicStatus` (BR1.5); API công khai **không** trả `internalStatus`, `matchScore`, thông tin người khác.
- Sai mã hồ sơ hay sai email/SĐT đều trả **cùng một thông báo** + giới hạn tần suất (NFR1.4, chống IDOR). Mã hồ sơ tuần tự nên việc xác thực chủ hồ sơ là bắt buộc.
- AI chỉ hỗ trợ, không đổi trạng thái hồ sơ (BR1.2, BR1.6). Dữ liệu 100% giả lập (`isMockData`, seed) — NFR1.1.

## 7. Điểm cần nhóm xác nhận (đang tạm giả định)

1. Thông tin xác thực khi tra cứu: đang chấp nhận **email hoặc SĐT** (tài liệu chỉ ghi "thông tin xác thực").
2. Danh sách chỉ hiện tin `OPEN`; tin `CLOSED` vẫn xem được chi tiết khi có link (luồng 6A1).
3. Nội dung màn hình `RESULT_AVAILABLE` hiện chỉ là câu thông báo chung.
4. Quan hệ Candidate — Application: tài liệu ghi `1 — 1..*`; code cho phép ứng viên chưa có hồ sơ nào được tạo cùng lúc với hồ sơ đầu tiên.
5. `phone` không đặt UNIQUE (tài liệu chỉ yêu cầu `email` duy nhất). Trùng hồ sơ xác định theo email + vị trí.
6. Đã bỏ các trường ngoài tài liệu mới (lương, số lượng, phòng ban, reviewedBy…) để khớp 100% mục 2.4.
7. Bảng `JobPosting` trong SQLite chỉ để demo độc lập; thực tế do Module 3 sở hữu.
8. Đã **thêm cột `AIScreening.errorMessage`** (ngoài tài liệu) để thực hiện yêu cầu "ghi nhận lỗi" của luồng 9E1.
9. Trạng thái `FAILED` của `AIScreening` chưa được dùng (tài liệu chưa nói khi nào chuyển sang `FAILED`, vd. sau bao nhiêu lần chạy lại thất bại).
10. "Fallback Mock API/JSON" hiện là JSON **rỗng** có cờ `isFallbackMock` (trung thực, không giả làm kết quả AI). Nếu nhóm muốn mock có dữ liệu mẫu, cần xác nhận.
11. Ai được xem kết quả AI và chạy lại AI: hiện là API nội bộ có khóa dịch vụ; vai trò HR_RECRUITER thật (đăng nhập, RBAC, đổi trạng thái hồ sơ) thuộc M3/M5, chưa làm trong M1.
