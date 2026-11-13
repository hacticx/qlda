const crypto = require('crypto');
const path = require('path');
const db = require('../db/database');
const config = require('../config');
const AppError = require('../utils/AppError');
const { INTERNAL_TO_PUBLIC, findStep } = require('../utils/statusMapper');
const jobCatalog = require('./JobCatalogController');
const JobPosting = require('../entities/JobPosting');
const Candidate = require('../entities/Candidate');
const Application = require('../entities/Application');
const CVDocument = require('../entities/CVDocument');
const AIScreening = require('../entities/AIScreening');
const S3StorageGateway = require('../gateways/S3StorageGateway');
const AIEngineGateway = require('../gateways/AIEngineGateway');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?84|0)\d{9}$/;

// Chữ ký (magic bytes) hợp lệ của từng định dạng CV — FR1.4
const CV_FORMATS = {
  PDF: Buffer.from([0x25, 0x50, 0x44, 0x46]),  // "%PDF"
  DOCX: Buffer.from([0x50, 0x4b, 0x03, 0x04]), // "PK.." (DOCX là file ZIP)
};

// Kết quả AI luôn kèm lời nhắc này (BR1.2, BR1.6)
const AI_ADVISORY_NOTICE =
  'Kết quả do AI cung cấp chỉ mang tính tham khảo. Quyết định về trạng thái hồ sơ thuộc về nhân sự có thẩm quyền (HR).';

const parseJson = (text, fallback) => { try { return JSON.parse(text) ?? fallback; } catch { return fallback; } };

// UC1.2 — Nộp hồ sơ ứng tuyển (tác nhân phụ: AI Engine)
class JobApplicationController {
  // Luồng chính: kiểm tra → lưu → gửi AI → lưu kết quả AI → trả mã hồ sơ (bước 4–10 của UC1.2)
  async submitApplication(body, file) {
    const form = this.validateCandidateFields(body);                  // 4A1: thiếu thông tin
    const job = this.assertJobAcceptsApplications(form.jobPostingId); // BR1.1, 11E1

    const fileExtension = this.validateCVFileFormatAndSize(file);     // 6E1, 6E2
    const magicBytesHex = this.verifyCVMagicBytes(file, fileExtension);

    this.checkDuplicateApplication(form.email, job.jobPostingId);     // BR1.3

    const saved = await this.saveApplicationAndCV(form, job, file, { fileExtension, magicBytesHex });

    // Bước 6–8: AI chạy SAU khi hồ sơ đã lưu. Lỗi AI không bao giờ làm mất hồ sơ (8A1, 9E1, NFR1.6)
    await this.runAIScreening(job, saved, { buffer: file.buffer, fileExtension });

    return {
      applicationCode: saved.applicationCode,
      jobTitle: job.title,
      publicStatus: 'RECEIVED',
      statusLabel: findStep('RECEIVED').label,
      // Cố ý KHÔNG trả kết quả/điểm AI cho ứng viên (BR1.6, BR1.5)
    };
  }

  validateCandidateFields(body) {
    const errors = {};
    const fullName = (body.fullName || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const phone = (body.phone || '').replace(/\s/g, '');

    if (!body.jobPostingId) errors.jobPostingId = 'Thiếu vị trí ứng tuyển.';
    if (fullName.length < 2) errors.fullName = 'Vui lòng nhập họ tên.';
    if (!EMAIL_RE.test(email)) errors.email = 'Email không hợp lệ.';
    if (!PHONE_RE.test(phone)) errors.phone = 'Số điện thoại không hợp lệ.';
    if (Object.keys(errors).length) throw new AppError(400, 'VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', errors);

    return { jobPostingId: body.jobPostingId, fullName, email, phone, coverLetter: (body.coverLetter || '').trim() || null };
  }

  // Dùng lại 2 quy tắc của JobCatalogController (Control gọi Control)
  assertJobAcceptsApplications(jobPostingId) {
    if (!JobPosting.findById(jobPostingId)) throw new AppError(404, 'JOB_NOT_FOUND', 'Tin tuyển dụng không tồn tại.');
    if (!jobCatalog.checkJobOpenStatus(jobPostingId)) throw new AppError(409, 'JOB_CLOSED', 'Tin tuyển dụng đã đóng, không nhận thêm hồ sơ.');
    if (!jobCatalog.verifyApplicationDeadline(jobPostingId)) throw new AppError(409, 'JOB_EXPIRED', 'Đã hết hạn nộp hồ sơ cho vị trí này.');
    return JobPosting.findById(jobPostingId);
  }

  // Trả về phần mở rộng chuẩn hóa: "PDF" | "DOCX"
  validateCVFileFormatAndSize(file) {
    if (!file) throw new AppError(400, 'CV_REQUIRED', 'Vui lòng đính kèm CV (PDF hoặc DOCX).');
    const fileExtension = path.extname(file.originalname).replace('.', '').toUpperCase();
    if (!CV_FORMATS[fileExtension]) throw new AppError(400, 'CV_INVALID_TYPE', 'CV chỉ chấp nhận định dạng PDF hoặc DOCX.');
    if (file.size < 1 || file.size > config.maxCvBytes) throw new AppError(400, 'CV_TOO_LARGE', 'CV vượt quá dung lượng tối đa 10 MB.');
    return fileExtension;
  }

  // Chặn file đổi đuôi giả (vd. .exe đổi thành .pdf). Trả về chữ ký dạng hex.
  verifyCVMagicBytes(file, fileExtension) {
    const head = file.buffer.subarray(0, 4);
    if (!head.equals(CV_FORMATS[fileExtension]))
      throw new AppError(400, 'CV_INVALID_CONTENT', 'Nội dung tệp không khớp với định dạng khai báo. Vui lòng tải lại CV hợp lệ.');
    return head.toString('hex');
  }

  checkDuplicateApplication(email, jobPostingId) {
    const candidate = Candidate.findByEmail(email);
    if (candidate && Application.exists(candidate.candidateId, jobPostingId))
      throw new AppError(409, 'DUPLICATE_APPLICATION', 'Bạn đã nộp hồ sơ cho vị trí này. Hãy dùng chức năng tra cứu để xem tiến độ.');
  }

  // Lưu CV gốc rồi ghi Candidate + Application + CVDocument + AIScreening(PENDING) trong MỘT transaction
  async saveApplicationAndCV(form, job, file, { fileExtension, magicBytesHex }) {
    const s3ObjectKey = await S3StorageGateway.upload(file.buffer, fileExtension);
    const internalStatus = 'SUBMITTED';

    try {
      return db.transaction(() => {
        // 11E1: tin có thể vừa bị đóng trong lúc ứng viên đang nộp → kiểm tra lại trong transaction
        this.assertJobAcceptsApplications(job.jobPostingId);

        const candidateId = Candidate.findByEmail(form.email)?.candidateId || Candidate.create(form);
        const { applicationId, applicationCode } = Application.create({
          jobPostingId: job.jobPostingId,
          candidateId,
          coverLetter: form.coverLetter,
          internalStatus,
          publicStatus: INTERNAL_TO_PUBLIC[internalStatus],
        });
        const cvId = CVDocument.create({
          applicationId, candidateId, s3ObjectKey, fileExtension, magicBytesHex,
          originalFilename: file.originalname,
          fileSizeBytes: file.size,
          fileHashSha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
        });
        const aiScreeningId = AIScreening.createPending({ applicationId, cvId });
        return { applicationId, applicationCode, cvId, aiScreeningId };
      })();
    } catch (err) {
      await S3StorageGateway.remove(s3ObjectKey); // 7E1: không để lại CV mồ côi
      throw err;
    }
  }

  // Bước 6–8: gửi CV → nhận dữ liệu → lưu. Không bao giờ ném lỗi ra ngoài.
  async runAIScreening(job, saved, cv) {
    const outcome = await this.sendCVToAIEngine(job, cv);
    return this.handleAIFallbackResult(outcome, saved);
  }

  // Trả { success:true, data } (đã kiểm tra hợp lệ) hoặc { success:false, error:{code,message} }
  async sendCVToAIEngine(job, cv) {
    try {
      return { success: true, data: await AIEngineGateway.analyzeCv({ job, cv }) };
    } catch (err) {
      return { success: false, error: { code: err.code || 'AI_ERROR', message: err.message } };
    }
  }

  // AI OK → SUCCESS (đủ 3 nhóm thông tin) hoặc PARTIAL (thiếu nhóm nào đó).
  // AI lỗi (8A1/9E1) → ghi nhận lỗi, KHÔNG dùng dữ liệu AI, dùng dự phòng FALLBACK_MOCK; hồ sơ vẫn hợp lệ (NFR1.6).
  // Hàm này chỉ ghi AIScreening — tuyệt đối không đổi trạng thái hồ sơ (BR1.2).
  handleAIFallbackResult(outcome, saved) {
    let update;
    if (outcome.success) {
      const d = outcome.data;
      const complete = d.skills.length > 0 && d.experience.length > 0 && d.education.length > 0;
      update = { ...d, status: complete ? 'SUCCESS' : 'PARTIAL', isFallbackMock: false, errorMessage: null };
    } else {
      console.warn(`[AI] ${saved.applicationCode}: ${outcome.error.code} — dùng Fallback Mock`);
      update = {
        ...AIEngineGateway.FALLBACK_RESULT,
        status: 'FALLBACK_MOCK',
        isFallbackMock: true,
        errorMessage: `${outcome.error.code}: ${outcome.error.message}`.slice(0, 300),
      };
    }
    try {
      AIScreening.update(saved.aiScreeningId, update);
    } catch (err) {
      console.error('[AI] Không lưu được AIScreening (hồ sơ vẫn hợp lệ):', err.message);
    }
    return update.status;
  }

  // ---------- Dành cho nhân sự / module khác (API nội bộ) ----------

  // "AI Engine → UC1.2: Trả về thông tin CV đã trích xuất" — đọc lại kết quả đã lưu (FR1.7)
  getAIScreeningResult(applicationCode) {
    const { application, screening } = this.findApplicationAndScreening(applicationCode);
    if (!screening) throw new AppError(404, 'AI_RESULT_NOT_FOUND', 'Hồ sơ này chưa có bản ghi phân tích AI.');
    return {
      applicationCode: application.applicationCode,
      jobTitle: application.jobTitle,
      status: screening.status,                       // PENDING | SUCCESS | PARTIAL | FALLBACK_MOCK | FAILED
      isFallbackMock: !!screening.isFallbackMock,     // true = dữ liệu dự phòng, KHÔNG phải kết quả AI thật
      matchScore: screening.matchScore,               // điểm THAM KHẢO
      skills: parseJson(screening.extractedSkillsJson, []),
      experience: parseJson(screening.extractedExperienceJson, []),
      education: parseJson(screening.extractedEducationJson, []),
      errorMessage: screening.errorMessage,
      internalStatus: application.internalStatus,     // do HR quyết định; AI không đổi
      notice: AI_ADVISORY_NOTICE,
    };
  }

  // 8A1: "việc trích xuất bằng AI được thực hiện bổ sung sau" — chạy lại cho hồ sơ chưa có kết quả AI thật
  async retryAIScreening(applicationCode) {
    const { application, screening } = this.findApplicationAndScreening(applicationCode);
    if (!screening) throw new AppError(404, 'AI_RESULT_NOT_FOUND', 'Hồ sơ này chưa có bản ghi phân tích AI.');
    if (['SUCCESS', 'PARTIAL'].includes(screening.status))
      throw new AppError(409, 'AI_ALREADY_DONE', 'Hồ sơ này đã có kết quả phân tích AI.');

    const cvDoc = CVDocument.findByApplicationId(application.applicationId);
    const buffer = await S3StorageGateway.download(cvDoc.s3ObjectKey);
    if (!buffer) throw new AppError(410, 'CV_FILE_MISSING', 'Không tìm thấy tệp CV gốc để phân tích lại.');

    const job = JobPosting.findById(application.jobPostingId);
    await this.runAIScreening(job, { ...application, aiScreeningId: screening.aiScreeningId }, { buffer, fileExtension: cvDoc.fileExtension });
    return this.getAIScreeningResult(applicationCode);
  }

  findApplicationAndScreening(applicationCode) {
    const application = Application.findByCodeWithOwner(String(applicationCode || '').trim().toUpperCase());
    if (!application) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
    return { application, screening: AIScreening.findByApplicationId(application.applicationId) };
  }
}

module.exports = new JobApplicationController();
