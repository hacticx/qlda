// BR1.5: ánh xạ trạng thái nội bộ -> trạng thái được phép công khai cho ứng viên.
const INTERNAL_TO_PUBLIC = {
  SUBMITTED: 'RECEIVED',
  SCREENING: 'UNDER_REVIEW',
  SHORTLISTED: 'UNDER_REVIEW',
  INTERVIEW_SCHEDULED: 'INTERVIEWING',
  INTERVIEWED: 'INTERVIEWING',
  OFFERED: 'RESULT_AVAILABLE',
  HIRED: 'RESULT_AVAILABLE',
  REJECTED: 'RESULT_AVAILABLE',
};

// Thứ tự các bước hiển thị trên thanh tiến độ
const PUBLIC_STEPS = [
  { key: 'RECEIVED', label: 'Đã tiếp nhận', hint: 'Hồ sơ và CV của bạn đã được lưu. Chúng tôi sẽ sớm xem xét.' },
  { key: 'UNDER_REVIEW', label: 'Đang xét duyệt', hint: 'Hồ sơ của bạn đang được bộ phận tuyển dụng xem xét.' },
  { key: 'INTERVIEWING', label: 'Đang phỏng vấn', hint: 'Bạn đã bước vào giai đoạn phỏng vấn.' },
  // CẦN XÁC NHẬN: nội dung chi tiết màn hình kết quả
  { key: 'RESULT_AVAILABLE', label: 'Đã có kết quả', hint: 'Đã có kết quả tuyển dụng. Bộ phận Nhân sự sẽ liên hệ trực tiếp với bạn.' },
];

const findStep = (publicStatus) => PUBLIC_STEPS.find((s) => s.key === publicStatus);

module.exports = { INTERNAL_TO_PUBLIC, PUBLIC_STEPS, findStep };
