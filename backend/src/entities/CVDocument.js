const db = require('../db/database');
const { newId } = require('../utils/id');

const CVDocument = {
  create(cv) {
    const cvId = newId('CV');
    db.prepare(`INSERT INTO CVDocument
      (cvId, applicationId, candidateId, originalFilename, s3ObjectKey, fileExtension, magicBytesHex, fileSizeBytes, fileHashSha256, isImmutable)
      VALUES (?,?,?,?,?,?,?,?,?,1)`)
      .run(cvId, cv.applicationId, cv.candidateId, cv.originalFilename, cv.s3ObjectKey,
        cv.fileExtension, cv.magicBytesHex, cv.fileSizeBytes, cv.fileHashSha256);
    return cvId;
  },
  findByApplicationId: (applicationId) => db.prepare('SELECT * FROM CVDocument WHERE applicationId = ?').get(applicationId),
};

module.exports = CVDocument;
