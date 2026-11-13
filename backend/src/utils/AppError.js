// Lỗi nghiệp vụ có mã HTTP + mã lỗi để frontend hiển thị thông báo phù hợp.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
module.exports = AppError;
