const path = require('path');
const BACKEND_ROOT = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(BACKEND_ROOT, '.env') });

// Mọi đường dẫn tương đối được tính từ thư mục backend (chạy từ đâu cũng được)
const fromRoot = (p) => path.resolve(BACKEND_ROOT, p);

module.exports = {
  port: Number(process.env.PORT) || 3001,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  dbFile: fromRoot(process.env.DB_FILE || './smarthr_m1.sqlite'),
  uploadDir: fromRoot(process.env.UPLOAD_DIR || './uploads'),
  maxCvBytes: Number(process.env.MAX_CV_BYTES) || 10 * 1024 * 1024, // 10 MB (BCE/ERD)

  ai: {
    mode: process.env.AI_MODE || 'mock',          // mock | gemini | fail (giả lập AI hỏng)
    apiKey: process.env.AI_API_KEY || '',         // KHÔNG commit key vào code
    baseUrl: process.env.AI_BASE_URL || 'https://aiplatform.googleapis.com/v1', // Vertex AI express mode
    model: process.env.AI_MODEL || 'gemini-2.5-flash',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 20000,
  },

  // Khóa dịch vụ cho API nội bộ (đọc/chạy lại kết quả AI). Chỉ là chỗ giữ chỗ cho RBAC của M5/M3.
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY || 'demo-hr-key',
};
