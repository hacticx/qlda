const crypto = require('crypto');

// Sinh khóa chính dạng chuỗi (String PK theo tài liệu), VD: CAN-9F3A12BC
const newId = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

module.exports = { newId };
