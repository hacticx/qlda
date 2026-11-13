const crypto = require('crypto');
const config = require('../config');

const digest = (v) => crypto.createHash('sha256').update(String(v)).digest();

// Bảo vệ API nội bộ (kết quả AI chỉ dành cho nhân sự có thẩm quyền — không phải ứng viên).
// Chỉ là chỗ giữ chỗ: bản thật dùng đăng nhập + RBAC (M5/M3).
module.exports = (req, res, next) => {
  const key = req.get('x-service-key');
  if (!key || !crypto.timingSafeEqual(digest(key), digest(config.internalServiceKey)))
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Không có quyền truy cập chức năng này.' } });
  next();
};
