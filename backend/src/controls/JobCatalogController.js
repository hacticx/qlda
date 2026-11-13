const JobPosting = require('../entities/JobPosting');
const AppError = require('../utils/AppError');

// ---- Hai quy tắc nền, dùng chung ----
const isOpen = (job) => job.status === 'OPEN';
const isBeforeDeadline = (job) => new Date() <= new Date(job.applicationDeadline);

// Dữ liệu công khai của một tin (UC1.1) + cờ cho UI biết có hiện nút Ứng tuyển không
function toPublicView(job) {
  return {
    jobPostingId: job.jobPostingId,
    jobCode: job.jobCode,
    title: job.title,
    jobDescription: job.jobDescription,
    jobRequirements: job.jobRequirements,
    workLocation: job.workLocation,
    applicationDeadline: job.applicationDeadline,
    status: job.status,
    isAcceptingApplications: isOpen(job) && isBeforeDeadline(job),
  };
}

// UC1.1 — Xem tin tuyển dụng (đọc dữ liệu JobPosting từ M3, BR1.1)
class JobCatalogController {
  getOpenJobPostings(keyword) {
    return JobPosting.findOpen(keyword).map(toPublicView);
  }

  // Luồng 6A1: tin đã đóng vẫn xem được chi tiết, nhưng isAcceptingApplications = false
  getJobPostingDetail(jobCode) {
    const job = JobPosting.findByCode(jobCode);
    if (!job || job.status === 'DRAFT')
      throw new AppError(404, 'JOB_NOT_FOUND', 'Tin tuyển dụng không tồn tại hoặc không còn công khai.');
    return toPublicView(job);
  }

  checkJobOpenStatus(jobId) {
    const job = JobPosting.findById(jobId);
    return !!job && isOpen(job);
  }

  verifyApplicationDeadline(jobId) {
    const job = JobPosting.findById(jobId);
    return !!job && isBeforeDeadline(job);
  }
}

module.exports = new JobCatalogController();
