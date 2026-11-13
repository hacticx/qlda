// Giới hạn số lần gọi theo IP (chống dò mã hồ sơ). Production nên dùng express-rate-limit/Redis.
module.exports = ({ windowMs = 60_000, max = 10 } = {}) => {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs).concat(now);
    hits.set(req.ip, recent);
    if (recent.length > max)
      return res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.' } });
    next();
  };
};
