const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// Nâng cấp DB cũ: thêm cột errorMessage nếu chưa có
const aiCols = db.prepare('PRAGMA table_info(AIScreening)').all().map((c) => c.name);
if (!aiCols.includes('errorMessage')) db.exec('ALTER TABLE AIScreening ADD COLUMN errorMessage TEXT');

module.exports = db;
