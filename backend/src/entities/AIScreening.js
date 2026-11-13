const db = require('../db/database');
const { newId } = require('../utils/id');

// LƯU Ý (BR1.2/BR1.6): entity này chỉ giữ KẾT QUẢ THAM KHẢO của AI.
// Không có hàm nào ở đây (hay ở Gateway AI) được phép đổi Application.internalStatus / publicStatus.
const AIScreening = {
  // Tạo bản ghi PENDING ngay lúc lưu hồ sơ → hồ sơ luôn có chỗ chờ AI, có thể chạy lại sau (8A1)
  createPending({ applicationId, cvId }) {
    const aiScreeningId = newId('AI');
    db.prepare("INSERT INTO AIScreening (aiScreeningId, applicationId, cvId, status) VALUES (?,?,?,'PENDING')")
      .run(aiScreeningId, applicationId, cvId);
    return aiScreeningId;
  },

  update(aiScreeningId, { matchScore, skills, experience, education, status, isFallbackMock, errorMessage }) {
    db.prepare(`UPDATE AIScreening SET matchScore = ?, extractedSkillsJson = ?, extractedExperienceJson = ?,
      extractedEducationJson = ?, status = ?, isFallbackMock = ?, errorMessage = ? WHERE aiScreeningId = ?`)
      .run(matchScore, JSON.stringify(skills), JSON.stringify(experience), JSON.stringify(education),
        status, isFallbackMock ? 1 : 0, errorMessage || null, aiScreeningId);
  },

  findByApplicationId: (applicationId) => db.prepare('SELECT * FROM AIScreening WHERE applicationId = ?').get(applicationId),
};

module.exports = AIScreening;
