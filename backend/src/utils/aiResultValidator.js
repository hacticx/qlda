const AIError = require('./AIError');

const invalid = (why) => new AIError('AI_INVALID_RESPONSE', `Dữ liệu AI không hợp lệ: ${why}`);
const str = (v, max = 300) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '');

function toList(value, field) {
  if (!Array.isArray(value)) throw invalid(`${field} phải là mảng`);
  return value;
}

// Chỉ giữ các trường đã biết, ép về chuỗi/giới hạn độ dài; bỏ phần tử rỗng
function pickFields(item, fields) {
  if (typeof item === 'string') return item.trim() ? { [fields[0]]: str(item) } : null;
  if (!item || typeof item !== 'object') return null;
  const out = {};
  fields.forEach((f) => { const v = str(item[f]); if (v) out[f] = v; });
  return Object.keys(out).length ? out : null;
}

// 9E1: AI trả dữ liệu sai cấu trúc → ném lỗi, KHÔNG dùng dữ liệu đó.
function validateAIResult(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid('không phải đối tượng JSON');

  const score = typeof raw.matchScore === 'string' ? Number(raw.matchScore) : raw.matchScore;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100)
    throw invalid('matchScore phải là số từ 0 đến 100');

  const skills = toList(raw.skills, 'skills').map((s) => str(s, 80)).filter(Boolean).slice(0, 50);
  const experience = toList(raw.experience, 'experience').map((e) => pickFields(e, ['title', 'company', 'period', 'description'])).filter(Boolean).slice(0, 20);
  const education = toList(raw.education, 'education').map((e) => pickFields(e, ['degree', 'school', 'year'])).filter(Boolean).slice(0, 10);

  return { matchScore: Math.round(score * 10) / 10, skills, experience, education };
}

module.exports = { validateAIResult };
