// Lỗi từ phía AI Engine. code: AI_UNAVAILABLE (8A1) | AI_ERROR | AI_INVALID_RESPONSE (9E1) | AI_CV_UNREADABLE | AI_NOT_CONFIGURED
class AIError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
module.exports = AIError;
