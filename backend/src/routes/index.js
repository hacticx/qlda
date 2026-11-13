// Lớp mỏng nhận HTTP và giao việc cho các Control. Không chứa nghiệp vụ.
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middlewares/rateLimit');
const uploadCv = require('../middlewares/uploadCv');
const requireServiceKey = require('../middlewares/requireServiceKey');
const jobCatalog = require('../controls/JobCatalogController');
const jobApplication = require('../controls/JobApplicationController');
const applicationTracking = require('../controls/ApplicationTrackingController');

router.get('/health', (req, res) => res.json({ ok: true }));

// ===== API CÔNG KHAI (Cổng Ứng viên) =====

// UC1.1 — Xem tin tuyển dụng
router.get('/job-postings', (req, res) => res.json({ data: jobCatalog.getOpenJobPostings(req.query.q) }));
router.get('/job-postings/:jobCode', (req, res) => res.json({ data: jobCatalog.getJobPostingDetail(req.params.jobCode) }));

// UC1.2 — Nộp hồ sơ (multipart/form-data: jobPostingId, fullName, email, phone, coverLetter, cv)
router.post('/applications', rateLimit({ max: 20 }), uploadCv,
  asyncHandler(async (req, res) => res.status(201).json({ data: await jobApplication.submitApplication(req.body, req.file) })));

// UC1.3 — Tra cứu (POST để mã hồ sơ/thông tin xác thực không nằm trên URL)
router.post('/applications/track', rateLimit({ max: 10 }),
  (req, res) => res.json({ data: applicationTracking.trackApplication(req.body) }));

// ===== API NỘI BỘ (dành cho HR/module khác — cần x-service-key) =====
// Chỉ ĐỌC kết quả AI và CHẠY LẠI AI. Không có API nào ở M1 cho AI đổi trạng thái hồ sơ (BR1.2, BR1.6).
const internal = require('express').Router();
internal.use(requireServiceKey);
internal.get('/applications/:applicationCode/ai-screening',
  (req, res) => res.json({ data: jobApplication.getAIScreeningResult(req.params.applicationCode) }));
internal.post('/applications/:applicationCode/ai-screening/retry', rateLimit({ max: 10 }),
  asyncHandler(async (req, res) => res.json({ data: await jobApplication.retryAIScreening(req.params.applicationCode) })));
router.use('/internal', internal);

module.exports = router;
