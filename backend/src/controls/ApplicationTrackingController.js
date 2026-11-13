const AppError = require('../utils/AppError');
const Application = require('../entities/Application');
const { INTERNAL_TO_PUBLIC, PUBLIC_STEPS, findStep } = require('../utils/statusMapper');

// Sai mã hoặc sai thông tin xác thực đều trả CÙNG một lỗi → không cho dò mã hồ sơ (NFR1.4, chống IDOR)
const notFoundError = () =>
  new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ khớp với thông tin đã nhập.');

// UC1.3 — Theo dõi trạng thái hồ sơ
class ApplicationTrackingController {
  trackApplication(input) {
    const { applicationCode, contactInfo } = this.validateTrackingInput(input);
    const application = this.verifyCandidateOwnership(applicationCode, contactInfo);
    const publicStatus = this.maskPublicStatus(application.internalStatus);
    const step = findStep(publicStatus);

    // Chỉ trả dữ liệu công khai: KHÔNG có internalStatus, matchScore, thông tin ứng viên...
    return {
      applicationCode: application.applicationCode,
      jobTitle: application.jobTitle,
      appliedAt: application.appliedAt,
      publicStatus,
      statusLabel: step.label,
      statusHint: step.hint,
      steps: PUBLIC_STEPS.map(({ key, label }) => ({ key, label })),
    };
  }

  validateTrackingInput({ applicationCode, contactInfo } = {}) {
    if (!applicationCode?.trim() || !contactInfo?.trim())
      throw new AppError(400, 'VALIDATION_ERROR', 'Vui lòng nhập mã hồ sơ và email/số điện thoại đã dùng khi ứng tuyển.');
    return { applicationCode: applicationCode.trim().toUpperCase(), contactInfo: contactInfo.trim() };
  }

  // Chỉ chủ hồ sơ (khớp email HOẶC số điện thoại) mới xem được
  verifyCandidateOwnership(applicationCode, contactInfo) {
    const application = this.getApplicationByCode(applicationCode);
    if (!application) throw notFoundError();

    const sameEmail = application.candidateEmail === contactInfo.toLowerCase();
    const samePhone = application.candidatePhone === contactInfo.replace(/\s/g, '');
    if (!sameEmail && !samePhone) throw notFoundError();
    return application;
  }

  getApplicationByCode(applicationCode) {
    return Application.findByCodeWithOwner(applicationCode);
  }

  // BR1.5: nội bộ -> công khai
  maskPublicStatus(internalStatus) {
    const publicStatus = INTERNAL_TO_PUBLIC[internalStatus];
    if (!publicStatus) throw new AppError(500, 'STATUS_UNKNOWN', 'Không xác định được trạng thái hồ sơ. Vui lòng thử lại sau.');
    return publicStatus;
  }
}

module.exports = new ApplicationTrackingController();
