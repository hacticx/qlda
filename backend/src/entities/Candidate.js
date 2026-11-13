const db = require('../db/database');
const { newId } = require('../utils/id');

const Candidate = {
  findByEmail: (email) => db.prepare('SELECT * FROM Candidate WHERE email = ?').get(email),

  create({ fullName, email, phone }) {
    const candidateId = newId('CAN');
    db.prepare('INSERT INTO Candidate (candidateId, fullName, email, phone) VALUES (?,?,?,?)')
      .run(candidateId, fullName, email, phone);
    return candidateId;
  },
};

module.exports = Candidate;
