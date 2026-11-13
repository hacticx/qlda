// Kiểm tra nhanh kết nối AI: npm run ai:check
// 1) Liệt kê các model mà KEY CỦA BẠN dùng được cho generateContent  2) Gọi thử đúng model đang cấu hình.
// Dùng khi gặp lỗi 404/401/403 để biết chính xác nên điền AI_MODEL nào.
const config = require('../config');

const { mode, apiKey, baseUrl, model, timeoutMs } = config.ai;
const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
const isVertex = baseUrl.includes('aiplatform');
const show = (title, v) => console.log(`${title.padEnd(12)}${v}`);

async function call(url, options = {}) {
  try {
    const res = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(timeoutMs) });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  } catch (err) {
    return { status: 0, body: { error: { message: `Không kết nối được (${err.name}: ${err.cause?.code || err.message})` } } };
  }
}

(async () => {
  console.log('=== Kiểm tra cấu hình AI ===');
  show('AI_MODE', mode);
  show('AI_BASE_URL', baseUrl);
  show('AI_MODEL', model);
  show('AI_API_KEY', apiKey ? `${apiKey.slice(0, 4)}…(${apiKey.length} ký tự)` : '(TRỐNG)');
  if (mode !== 'gemini') console.log(`\n⚠ AI_MODE=${mode} → hệ thống KHÔNG gọi AI thật. Đặt AI_MODE=gemini trong .env.`);
  if (!apiKey) { console.log('\n✖ Chưa có AI_API_KEY.'); process.exit(1); }

  if (!isVertex) {
    console.log('\n[1] Danh sách model dùng được với key này (hỗ trợ generateContent):');
    const list = await call(`${baseUrl}/models?pageSize=200`);
    if (list.status !== 200) {
      console.log(`  ✖ HTTP ${list.status}: ${list.body.error?.message || JSON.stringify(list.body)}`);
    } else {
      const names = (list.body.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''))
        .filter((n) => /gemini/.test(n));
      const flash = names.filter((n) => /flash/.test(n) && !/(image|tts|live|audio|embedding)/.test(n));
      console.log(`  Gợi ý (flash): ${flash.slice(0, 12).join(', ') || '(không có)'}`);
      console.log(`  Tất cả gemini: ${names.length} model`);
      if (!names.includes(model)) console.log(`  ⚠ "${model}" KHÔNG nằm trong danh sách → đổi AI_MODEL sang một model ở trên (vd. gemini-flash-latest).`);
    }
  }

  console.log(`\n[2] Gọi thử model "${model}":`);
  const url = isVertex ? `${baseUrl}/publishers/google/models/${model}:generateContent` : `${baseUrl}/models/${model}:generateContent`;
  const r = await call(url, { method: 'POST', body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Trả lời đúng một từ: OK' }] }] }) });
  if (r.status === 200) {
    const text = (r.body.candidates?.[0]?.content?.parts || []).map((p) => p.text).join('').trim();
    console.log(`  ✔ Thành công. AI trả lời: "${text}"  → có thể chạy AI thật.`);
  } else {
    console.log(`  ✖ HTTP ${r.status}: ${r.body.error?.message || JSON.stringify(r.body)}`);
    if (r.status === 404) console.log('  → Tên model sai/đã ngừng. Đổi AI_MODEL theo danh sách ở mục [1].');
    if (r.status === 401 || r.status === 403) console.log('  → Key bị từ chối hoặc API chưa bật/key bị giới hạn. Xem README mục "Lỗi thường gặp".');
    process.exit(1);
  }
})();
