const db = require('../db/database');
const { newId } = require('../utils/id');

const Application = {
  // Mã hồ sơ tuần tự theo năm: APP-2026-0001, APP-2026-0002...
  // Gọi bên trong transaction của better-sqlite3 (đồng bộ) nên không bị trùng số.
  nextApplicationCode(year = new Date().getFullYear()) {
    const { total } = db.prepare('SELECT COUNT(*) AS total FROM Application WHERE applicationCode LIKE ?').get(`APP-${year}-%`);
    return `APP-${year}-${String(total + 1).padStart(4, '0')}`;
  },

  exists: (candidateId, jobPostingId) =>
    !!db.prepare('SELECT 1 FROM Application WHERE candidateId = ? AND jobPostingId = ?').get(candidateId, jobPostingId),

  create({ jobPostingId, candidateId, coverLetter, internalStatus, publicStatus }) {
    const applicationId = newId('APP');
    const applicationCode = this.nextApplicationCode();
    db.prepare(`INSERT INTO Application
      (applicationId, applicationCode, jobPostingId, candidateId, internalStatus, publicStatus, coverLetter, appliedAt)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(applicationId, applicationCode, jobPostingId, candidateId, internalStatus, publicStatus, coverLetter, new Date().toISOString());
    return { applicationId, applicationCode };
  },

  // Chỉ dùng nội bộ (có email/phone để đối chiếu quyền sở hữu) — KHÔNG trả nguyên bản ra API.
  findByCodeWithOwner: (applicationCode) =>
    db.prepare(`SELECT a.*, j.title AS jobTitle, c.email AS candidateEmail, c.phone AS candidatePhone
      FROM Application a
      JOIN JobPosting j ON j.jobPostingId = a.jobPostingId
      JOIN Candidate  c ON c.candidateId  = a.candidateId
      WHERE a.applicationCode = ?`).get(applicationCode),
};

module.exports = Application;
