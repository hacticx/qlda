// Lưu tệp CV gốc. Bản demo ghi ra đĩa; khi lên production chỉ cần thay phần ruột bằng S3/MinIO.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

fs.mkdirSync(path.join(config.uploadDir, 'cv'), { recursive: true });

const S3StorageGateway = {
  // Trả về objectKey (lưu vào CVDocument.s3ObjectKey)
  async upload(buffer, fileExtension) {
    const objectKey = `cv/${crypto.randomUUID()}.${fileExtension.toLowerCase()}`;
    await fs.promises.writeFile(path.join(config.uploadDir, objectKey), buffer, { flag: 'wx' });
    return objectKey;
  },
  // Đọc lại CV gốc (dùng khi chạy lại AI sau — luồng 8A1). Trả null nếu tệp không còn.
  async download(objectKey) {
    try { return await fs.promises.readFile(path.join(config.uploadDir, objectKey)); } catch { return null; }
  },
  async remove(objectKey) {
    await fs.promises.rm(path.join(config.uploadDir, objectKey), { force: true });
  },
};

module.exports = S3StorageGateway;
