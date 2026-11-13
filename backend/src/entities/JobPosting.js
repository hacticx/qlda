const db = require('../db/database');

// JobPosting thuộc Module 3 → M1 chỉ có các hàm ĐỌC (tuân thủ G1: không ghi vào Entity của module khác).
const JobPosting = {
  findOpen(keyword) {
    const like = `%${keyword || ''}%`;
    return db.prepare(`SELECT * FROM JobPosting
      WHERE status = 'OPEN' AND (title LIKE ? OR workLocation LIKE ? OR jobDescription LIKE ?)
      ORDER BY applicationDeadline ASC`).all(like, like, like);
  },
  findByCode: (jobCode) => db.prepare('SELECT * FROM JobPosting WHERE jobCode = ?').get(jobCode),
  findById: (jobPostingId) => db.prepare('SELECT * FROM JobPosting WHERE jobPostingId = ?').get(jobPostingId),
};

module.exports = JobPosting;
