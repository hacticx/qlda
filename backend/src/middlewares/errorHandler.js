const notFound = (req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Đường dẫn không tồn tại.' } });

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.status) return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.' } });
}

module.exports = { notFound, errorHandler };
