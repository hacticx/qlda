// Kiểm thử UC1.2 ↔ AI Engine. Dùng AI Engine GIẢ (giả lập Vertex AI generateContent) để kiểm chứng
// luồng 8A1 / 9E1 / NFR1.6 và nguyên tắc BR1.2 / BR1.6. Chạy: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smarthr-test-'));
let mode = 'ok';          // hành vi của AI giả
let lastRequest = null;   // request AI giả nhận được gần nhất

const GOOD = { matchScore: 81, skills: ['React', 'SQL'], experience: [{ title: 'Dev', company: 'ACME' }], education: [{ degree: 'CNTT' }] };
const reply = (res, obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
const geminiBody = (json) => ({ candidates: [{ content: { parts: [{ text: typeof json === 'string' ? json : JSON.stringify(json) }] } }] });

const fakeAI = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    lastRequest = { url: req.url, key: req.headers['x-goog-api-key'], body: JSON.parse(body || '{}') };
    if (mode === 'down') { res.statusCode = 503; return reply(res, { error: 'unavailable' }); }
    if (mode === 'forbidden') { res.statusCode = 403; return reply(res, { error: 'denied' }); }
    if (mode === 'model404') { res.statusCode = 404; return reply(res, { error: { code: 404, message: 'models/gemini-test is not found for API version v1beta', status: 'NOT_FOUND' } }); }
    if (mode === 'service_disabled') {
      res.statusCode = 403;
      return reply(res, { error: { code: 403, message: 'Vertex AI API has not been used in project 829212634663 before or it is disabled.', status: 'PERMISSION_DENIED', details: [{ reason: 'SERVICE_DISABLED' }] } });
    }
    if (mode === 'badjson') return reply(res, geminiBody('xin chào, đây không phải JSON'));
    if (mode === 'badscore') return reply(res, geminiBody({ ...GOOD, matchScore: 150 }));
    if (mode === 'partial') return reply(res, geminiBody({ ...GOOD, education: [] }));
    if (mode === 'fenced') return reply(res, geminiBody('```json\n' + JSON.stringify(GOOD) + '\n```'));
    return reply(res, geminiBody(GOOD));
  });
});

let base, db, server;
test.before(async () => {
  await new Promise((r) => fakeAI.listen(0, r));
  Object.assign(process.env, {
    DB_FILE: path.join(tmp, 't.sqlite'), UPLOAD_DIR: path.join(tmp, 'up'), AI_MODE: 'gemini',
    AI_BASE_URL: `http://127.0.0.1:${fakeAI.address().port}/v1beta`, // trỏ về AI giả, không gọi Google thật
    AI_MODEL: 'gemini-test', AI_API_KEY: 'test-key', AI_TIMEOUT_MS: '2000',
    INTERNAL_SERVICE_KEY: 'k-test',
  });
  db = require('../src/db/database');
  db.prepare(`INSERT INTO JobPosting VALUES ('JP-T1','JOB-T1','Dev React','Làm giao diện','React, JS','HN',?, 'OPEN')`)
    .run(new Date(Date.now() + 86400000).toISOString());
  server = require('../src/app').listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => { server.close(); fakeAI.close(); });

let n = 0;
async function submit({ name = 'cv.pdf', content = '%PDF-1.4 mock' } = {}) {
  n += 1;
  const fd = new FormData();
  fd.append('jobPostingId', 'JP-T1'); fd.append('fullName', `Ứng viên ${n}`);
  fd.append('email', `u${n}@example.com`); fd.append('phone', `09000000${String(n).padStart(2, '0')}`);
  fd.append('cv', new Blob([content]), name);
  const res = await fetch(`${base}/applications`, { method: 'POST', body: fd });
  return { status: res.status, body: await res.json(), email: `u${n}@example.com` };
}
const screening = (code) => db.prepare(`SELECT s.* FROM AIScreening s JOIN Application a USING(applicationId) WHERE a.applicationCode = ?`).get(code);
const application = (code) => db.prepare('SELECT * FROM Application WHERE applicationCode = ?').get(code);
const internalGet = (code, key = 'k-test') => fetch(`${base}/internal/applications/${code}/ai-screening`, { headers: key ? { 'x-service-key': key } : {} });
const internalRetry = (code) => fetch(`${base}/internal/applications/${code}/ai-screening/retry`, { method: 'POST', headers: { 'x-service-key': 'k-test' } });

test('UC1.2 bước 6-8: AI trả dữ liệu → lưu SUCCESS; gửi đúng key + CV + JD tới AI', async () => {
  mode = 'ok';
  const r = await submit();
  assert.equal(r.status, 201);
  const code = r.body.data.applicationCode;
  const s = screening(code);
  assert.equal(s.status, 'SUCCESS'); assert.equal(s.isFallbackMock, 0); assert.equal(s.matchScore, 81);
  assert.deepEqual(JSON.parse(s.extractedSkillsJson), ['React', 'SQL']);
  // gọi đúng endpoint Vertex express, key nằm ở header, CV PDF gửi dạng inlineData, có JD trong prompt
  assert.equal(lastRequest.url, '/v1beta/models/gemini-test:generateContent');
  assert.equal(lastRequest.key, 'test-key');
  const parts = lastRequest.body.contents[0].parts;
  assert.equal(parts[1].inlineData.mimeType, 'application/pdf');
  assert.match(parts[0].text, /Dev React/);
});

test('BR1.2: AI không đổi trạng thái hồ sơ; BR1.6: ứng viên không thấy dữ liệu AI', async () => {
  mode = 'ok';
  const r = await submit();
  const code = r.body.data.applicationCode;
  const app = application(code);
  assert.equal(app.internalStatus, 'SUBMITTED'); assert.equal(app.publicStatus, 'RECEIVED');
  assert.equal(JSON.stringify(r.body).includes('matchScore'), false, 'phản hồi nộp hồ sơ không được chứa điểm AI');

  const t = await fetch(`${base}/applications/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationCode: code, contactInfo: r.email }) });
  const tracked = JSON.stringify(await t.json());
  for (const leak of ['matchScore', 'skills', 'ACME', 'internalStatus', 'isFallbackMock']) assert.equal(tracked.includes(leak), false, `lộ ${leak}`);
});

test('8A1: AI không khả dụng → hồ sơ VẪN lưu, ghi FALLBACK_MOCK + lỗi, không có dữ liệu AI', async () => {
  mode = 'down';
  const r = await submit();
  assert.equal(r.status, 201);
  const s = screening(r.body.data.applicationCode);
  assert.equal(s.status, 'FALLBACK_MOCK'); assert.equal(s.isFallbackMock, 1); assert.equal(s.matchScore, null);
  assert.deepEqual(JSON.parse(s.extractedSkillsJson), []);
  assert.match(s.errorMessage, /^AI_UNAVAILABLE/);
  assert.ok(db.prepare('SELECT 1 FROM CVDocument WHERE applicationId = ?').get(application(r.body.data.applicationCode).applicationId));
});

test('9E1: AI trả lỗi / JSON hỏng / điểm ngoài 0-100 → không dùng dữ liệu AI, dùng dự phòng', async () => {
  const cases = [['forbidden', /^AI_AUTH_FAILED/], ['badjson', /^AI_INVALID_RESPONSE/], ['badscore', /^AI_INVALID_RESPONSE/]];
  for (const [m, re] of cases) {
    mode = m;
    const r = await submit();
    assert.equal(r.status, 201, m);
    const s = screening(r.body.data.applicationCode);
    assert.equal(s.status, 'FALLBACK_MOCK', m); assert.equal(s.matchScore, null, m);
    assert.match(s.errorMessage, re, m);
  }
});

test('AI trả thiếu một nhóm thông tin → PARTIAL; JSON bọc ```json vẫn đọc được', async () => {
  mode = 'partial';
  assert.equal(screening((await submit()).body.data.applicationCode).status, 'PARTIAL');
  mode = 'fenced';
  assert.equal(screening((await submit()).body.data.applicationCode).status, 'SUCCESS');
});

test('DOCX không đọc được → dự phòng AI_CV_UNREADABLE, hồ sơ vẫn lưu', async () => {
  mode = 'ok';
  const r = await submit({ name: 'cv.docx', content: 'PK\u0003\u0004 không phải docx thật' });
  assert.equal(r.status, 201);
  const s = screening(r.body.data.applicationCode);
  assert.equal(s.status, 'FALLBACK_MOCK'); assert.match(s.errorMessage, /^AI_CV_UNREADABLE/);
});

test('8A1 "thực hiện bổ sung sau": chạy lại AI cho hồ sơ FALLBACK_MOCK → SUCCESS, trạng thái hồ sơ không đổi', async () => {
  mode = 'down';
  const code = (await submit()).body.data.applicationCode;
  assert.equal(screening(code).status, 'FALLBACK_MOCK');

  mode = 'ok';
  const res = await internalRetry(code);
  assert.equal(res.status, 200);
  const data = (await res.json()).data;
  assert.equal(data.status, 'SUCCESS'); assert.equal(data.isFallbackMock, false); assert.equal(data.matchScore, 81);
  assert.equal(application(code).internalStatus, 'SUBMITTED');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM AIScreening WHERE applicationId = ?').get(application(code).applicationId).c, 1);

  assert.equal((await internalRetry(code)).status, 409, 'đã có kết quả thì không chạy lại');
});

test('API nội bộ trả "thông tin CV đã trích xuất" kèm lời nhắc HR quyết định; cần service key', async () => {
  mode = 'ok';
  const code = (await submit()).body.data.applicationCode;
  assert.equal((await internalGet(code, null)).status, 401);
  assert.equal((await internalGet(code, 'sai-key')).status, 401);
  const data = (await (await internalGet(code)).json()).data;
  assert.deepEqual(data.skills, ['React', 'SQL']);
  assert.equal(data.internalStatus, 'SUBMITTED');
  assert.match(data.notice, /tham khảo/); assert.match(data.notice, /HR/);
  assert.equal('email' in data || 'phone' in data, false, 'không lộ thông tin liên hệ ứng viên');
});

test('Lỗi "chưa bật Vertex AI API" được nhận diện và kèm hướng dẫn bật', async () => {
  mode = 'service_disabled';
  const r = await submit();
  assert.equal(r.status, 201); // hồ sơ vẫn lưu (8A1/9E1)
  const s = screening(r.body.data.applicationCode);
  assert.equal(s.status, 'FALLBACK_MOCK');
  assert.match(s.errorMessage, /AI_AUTH_FAILED/);
  assert.match(s.errorMessage, /chưa được BẬT|Enable/);
});

// Unit test trực tiếp cho gateway (không qua HTTP): kiểm tra AI_MODE không hợp lệ
test('AIEngineGateway: AI_MODE không hợp lệ → ném AI_NOT_CONFIGURED', async () => {
  const savedMode = process.env.AI_MODE;
  // Reload gateway với mode mới (clear cache)
  Object.keys(require.cache).filter(k => k.includes('AIEngineGateway') || k.includes('config')).forEach(k => delete require.cache[k]);
  process.env.AI_MODE = 'groq';
  const gw = require('../src/gateways/AIEngineGateway');
  try {
    await gw.analyzeCv({ job: { title: 'x', jobDescription: 'x', jobRequirements: 'x' }, cv: { fileExtension: 'PDF', buffer: Buffer.from('%PDF') } });
    assert.fail('phải ném lỗi');
  } catch (err) {
    assert.equal(err.code, 'AI_NOT_CONFIGURED');
    assert.match(err.message, /groq/);
  } finally {
    process.env.AI_MODE = savedMode;
    Object.keys(require.cache).filter(k => k.includes('AIEngineGateway') || k.includes('config')).forEach(k => delete require.cache[k]);
  }
});

test('Model không tồn tại (404) → ghi AI_MODEL_NOT_FOUND kèm hướng dẫn ai:check, hồ sơ vẫn lưu', async () => {
  mode = 'model404';
  const r = await submit();
  assert.equal(r.status, 201);
  const s = screening(r.body.data.applicationCode);
  assert.equal(s.status, 'FALLBACK_MOCK');
  assert.match(s.errorMessage, /AI_MODEL_NOT_FOUND/);
  assert.match(s.errorMessage, /ai:check/);
});
