const multer = require('multer');
const AppError = require('../utils/AppError');
const config = require('../config');

// memoryStorage: cần đọc magic bytes trước khi ghi ra đĩa
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxCvBytes, files: 1 } });

module.exports = (req, res, next) =>
  upload.single('cv')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError(400, 'CV_TOO_LARGE', 'CV vượt quá dung lượng tối đa 10 MB.'));
    next(new AppError(400, 'UPLOAD_ERROR', 'Không tải được tệp CV. Vui lòng thử lại.'));
  });
