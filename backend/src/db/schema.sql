-- Tên bảng/cột lấy đúng theo mục 2.4 (Lớp thực thể) của tài liệu phân tích Module 1.

-- JobPosting: thực thể của Module 3. M1 CHỈ ĐỌC (G1). Tạo bảng ở đây chỉ để chạy demo độc lập.
CREATE TABLE IF NOT EXISTS JobPosting (
  jobPostingId        TEXT PRIMARY KEY,
  jobCode             TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  jobDescription      TEXT NOT NULL,
  jobRequirements     TEXT NOT NULL,
  workLocation        TEXT,
  applicationDeadline TEXT NOT NULL,                 -- DateTime ISO-8601
  status              TEXT NOT NULL CHECK (status IN ('DRAFT','OPEN','CLOSED'))
);

CREATE TABLE IF NOT EXISTS Candidate (
  candidateId  TEXT PRIMARY KEY,
  userId       TEXT,                                 -- liên kết tài khoản M5 (nếu có), M1 không dùng
  fullName     TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  phone        TEXT NOT NULL,
  dateOfBirth  TEXT,
  address      TEXT,
  isMockData   INTEGER NOT NULL DEFAULT 1            -- NFR1.1
);

CREATE TABLE IF NOT EXISTS Application (
  applicationId   TEXT PRIMARY KEY,
  applicationCode TEXT NOT NULL UNIQUE,              -- VD: APP-2026-0001
  jobPostingId    TEXT NOT NULL REFERENCES JobPosting(jobPostingId),   -- BR1.4
  candidateId     TEXT NOT NULL REFERENCES Candidate(candidateId),     -- BR1.4
  internalStatus  TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (internalStatus IN ('SUBMITTED','SCREENING','SHORTLISTED','INTERVIEW_SCHEDULED','INTERVIEWED','OFFERED','HIRED','REJECTED')),
  publicStatus    TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (publicStatus IN ('RECEIVED','UNDER_REVIEW','INTERVIEWING','RESULT_AVAILABLE')),   -- BR1.5
  coverLetter     TEXT,
  appliedAt       TEXT NOT NULL,
  UNIQUE (candidateId, jobPostingId)                 -- BR1.3: không nộp trùng cùng vị trí
);

CREATE TABLE IF NOT EXISTS CVDocument (
  cvId             TEXT PRIMARY KEY,
  applicationId    TEXT NOT NULL UNIQUE REFERENCES Application(applicationId),   -- 1-1
  candidateId      TEXT NOT NULL REFERENCES Candidate(candidateId),
  originalFilename TEXT NOT NULL,
  s3ObjectKey      TEXT NOT NULL UNIQUE,             -- demo: đường dẫn trong thư mục uploads (thay cho S3)
  fileExtension    TEXT NOT NULL CHECK (fileExtension IN ('PDF','DOCX')),
  magicBytesHex    TEXT NOT NULL,
  fileSizeBytes    INTEGER NOT NULL CHECK (fileSizeBytes BETWEEN 1 AND 10485760),
  fileHashSha256   TEXT NOT NULL,
  isImmutable      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS AIScreening (
  aiScreeningId           TEXT PRIMARY KEY,
  applicationId           TEXT NOT NULL UNIQUE REFERENCES Application(applicationId),   -- 1 — 0..1
  cvId                    TEXT NOT NULL UNIQUE REFERENCES CVDocument(cvId),             -- 1 — 0..1
  matchScore              REAL,
  extractedSkillsJson     TEXT,
  extractedExperienceJson TEXT,
  extractedEducationJson  TEXT,
  status                  TEXT NOT NULL CHECK (status IN ('PENDING','SUCCESS','PARTIAL','FALLBACK_MOCK','FAILED')),
  isFallbackMock          INTEGER NOT NULL DEFAULT 0, -- NFR1.6
  errorMessage            TEXT                        -- BỔ SUNG ngoài tài liệu: ghi nhận lỗi AI (luồng 9E1)
);

CREATE INDEX IF NOT EXISTS idxJobStatus ON JobPosting(status);
