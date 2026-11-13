// Dữ liệu 100% giả lập (NFR1.1). Chạy: npm run seed
// Lưu ý: JobPosting thật do Module 3 quản lý; ở đây ghi trực tiếp CHỈ để demo M1 chạy độc lập.
const fs = require('fs');
const path = require('path');
const db = require('./database');
const config = require('../config');

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

db.exec('DELETE FROM AIScreening; DELETE FROM CVDocument; DELETE FROM Application; DELETE FROM Candidate; DELETE FROM JobPosting;');

const jobs = [
  ['JP-001', 'JOB-FE-001', 'Frontend Developer (React)', 'Phát triển giao diện web cho các sản phẩm nội bộ và khách hàng.',
    '- 1+ năm kinh nghiệm React/JavaScript\n- Hiểu HTML/CSS, Git\n- Ưu tiên biết Vite, REST API', 'Hà Nội', inDays(30), 'OPEN'],
  ['JP-002', 'JOB-BE-002', 'Backend Developer (Node.js)', 'Xây dựng API, tối ưu cơ sở dữ liệu và tích hợp dịch vụ AI.',
    '- Node.js/Express\n- SQL cơ bản\n- Có tư duy bảo mật API', 'Hà Nội / Remote', inDays(14), 'OPEN'],
  ['JP-003', 'JOB-HR-003', 'Chuyên viên Tuyển dụng', 'Sàng lọc hồ sơ, phối hợp phỏng vấn và theo dõi quy trình tuyển dụng.',
    '- Giao tiếp tốt\n- Ưu tiên có kinh nghiệm tuyển dụng IT', 'TP. Hồ Chí Minh', inDays(20), 'OPEN'],
  ['JP-004', 'JOB-QA-004', 'QA Engineer (đã đóng)', 'Kiểm thử chức năng và tự động hóa kiểm thử.',
    '- Hiểu quy trình kiểm thử\n- Biết viết test case', 'Đà Nẵng', inDays(-10), 'CLOSED'],                  // test luồng 6A1
  ['JP-005', 'JOB-DA-005', 'Data Analyst (hết hạn nộp)', 'Phân tích dữ liệu nhân sự và xây dựng dashboard.',
    '- SQL, Excel/Power BI\n- Tư duy phân tích', 'Hà Nội', inDays(-3), 'OPEN'],                            // OPEN nhưng quá hạn
  ['JP-006', 'JOB-DRAFT-006', 'Tin nháp (không công khai)', 'Chỉ HR thấy.', '-', 'Hà Nội', inDays(30), 'DRAFT'],
];
const insJob = db.prepare('INSERT INTO JobPosting VALUES (?,?,?,?,?,?,?,?)');
jobs.forEach((j) => insJob.run(...j));

// Hồ sơ mẫu phủ đủ 4 trạng thái công khai
const samples = [
  ['CAN-0001', 'Nguyễn Văn An', 'an.mock@example.com', '0900000001', 'JP-001', 'SUBMITTED'],
  ['CAN-0002', 'Trần Thị Bình', 'binh.mock@example.com', '0900000002', 'JP-001', 'SHORTLISTED'],
  ['CAN-0003', 'Lê Quốc Cường', 'cuong.mock@example.com', '0900000003', 'JP-002', 'INTERVIEW_SCHEDULED'],
  ['CAN-0004', 'Phạm Minh Dung', 'dung.mock@example.com', '0900000004', 'JP-002', 'REJECTED'],
];
const { INTERNAL_TO_PUBLIC } = require('../utils/statusMapper');

db.transaction(() => {
  samples.forEach(([cid, name, email, phone, jobId, internal], i) => {
    const n = String(i + 1).padStart(4, '0');
    db.prepare('INSERT INTO Candidate (candidateId, fullName, email, phone) VALUES (?,?,?,?)').run(cid, name, email, phone);
    db.prepare(`INSERT INTO Application (applicationId, applicationCode, jobPostingId, candidateId, internalStatus, publicStatus, appliedAt)
      VALUES (?,?,?,?,?,?,?)`).run(`APP-SEED${n}`, `APP-2026-${n}`, jobId, cid, internal, INTERNAL_TO_PUBLIC[internal], inDays(-5 + i));
    db.prepare(`INSERT INTO CVDocument (cvId, applicationId, candidateId, originalFilename, s3ObjectKey, fileExtension, magicBytesHex, fileSizeBytes, fileHashSha256)
      VALUES (?,?,?,?,?,'PDF','25504446',1024,'seed')`).run(`CV-SEED${n}`, `APP-SEED${n}`, cid, `cv_mock_${n}.pdf`, `seed/cv_mock_${n}.pdf`);
  });
})();

// Tạo tệp CV mẫu (PDF giả lập) để chức năng "Chạy lại AI" có CV gốc để đọc
fs.mkdirSync(path.join(config.uploadDir, 'seed'), { recursive: true });
for (let i = 1; i <= 4; i++) {
  fs.writeFileSync(path.join(config.uploadDir, 'seed', `cv_mock_${String(i).padStart(4, '0')}.pdf`), '%PDF-1.4 CV giả lập (mock data)');
}

// Kết quả AI mẫu để demo (dữ liệu giả lập): 2 SUCCESS, 1 PARTIAL, 1 FALLBACK_MOCK
const aiSamples = [
  { status: 'SUCCESS', score: 82.5, skills: ['React', 'JavaScript', 'HTML/CSS', 'Git'],
    exp: [{ title: 'Frontend Intern', company: 'Công ty Mock A', period: '2025', description: 'Xây dựng giao diện React' }],
    edu: [{ degree: 'Cử nhân CNTT', school: 'Đại học Mock', year: '2026' }] },
  { status: 'SUCCESS', score: 74, skills: ['JavaScript', 'Node.js', 'SQL'],
    exp: [{ title: 'Web Developer', company: 'Công ty Mock B', period: '2024-2025', description: 'Phát triển REST API' }],
    edu: [{ degree: 'Kỹ sư phần mềm', school: 'Đại học Mock', year: '2025' }] },
  { status: 'PARTIAL', score: 68, skills: ['Node.js', 'Express'], exp: [{ title: 'Backend Intern', company: 'Công ty Mock C' }], edu: [] },
  { status: 'FALLBACK_MOCK', score: null, skills: [], exp: [], edu: [],
    error: 'AI_UNAVAILABLE: AI Engine không phản hồi (TimeoutError).' },
];
aiSamples.forEach((a, i) => {
  const n = String(i + 1).padStart(4, '0');
  db.prepare(`INSERT INTO AIScreening (aiScreeningId, applicationId, cvId, matchScore, extractedSkillsJson, extractedExperienceJson,
    extractedEducationJson, status, isFallbackMock, errorMessage) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(`AI-SEED${n}`, `APP-SEED${n}`, `CV-SEED${n}`, a.score, JSON.stringify(a.skills), JSON.stringify(a.exp),
      JSON.stringify(a.edu), a.status, a.status === 'FALLBACK_MOCK' ? 1 : 0, a.error || null);
});

console.log('Seed xong. Dữ liệu tra cứu thử (mã hồ sơ / email → trạng thái công khai):');
samples.forEach(([, , email, , , internal], i) =>
  console.log(`  APP-2026-${String(i + 1).padStart(4, '0')}  /  ${email}  →  ${INTERNAL_TO_PUBLIC[internal]}`));
