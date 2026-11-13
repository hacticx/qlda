import { useState } from 'react';
import { candidatePortalApi } from '../api/candidatePortalApi.js';
import { ErrorBox } from '../components/Feedback.jsx';

const STATUS_VIEW = {
  SUCCESS: { label: 'Phân tích thành công', cls: 'ai-success' },
  PARTIAL: { label: 'Phân tích một phần', cls: 'ai-partial' },
  FALLBACK_MOCK: { label: 'Dữ liệu dự phòng (AI lỗi)', cls: 'ai-fallback' },
  PENDING: { label: 'Đang chờ phân tích', cls: 'ai-pending' },
  FAILED: { label: 'Phân tích thất bại', cls: 'ai-fallback' },
};

export default function AIResultDemoUI() {
  const [applicationCode, setApplicationCode] = useState('APP-2026-0001');
  const [serviceKey, setServiceKey] = useState('demo-hr-key');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function run(action) {
    setError('');
    setLoading(true);
    try {
      setResult(await action(applicationCode, serviceKey));
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const view = result && STATUS_VIEW[result.status];
  const needsRetry = result && ['PENDING', 'FALLBACK_MOCK', 'FAILED'].includes(result.status);

  return (
    <div className="narrow">
      <div className="card">
        <h1>Kết quả phân tích CV bằng AI</h1>
        <ErrorBox message={error} />
        <form onSubmit={(e) => { e.preventDefault(); run(candidatePortalApi.getAIScreeningResult); }}>
          <div className="field">
            <label htmlFor="code">Mã hồ sơ</label>
            <input id="code" type="text" value={applicationCode} onChange={(e) => setApplicationCode(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="key">Khóa dịch vụ nội bộ</label>
            <input id="key" type="text" value={serviceKey} onChange={(e) => setServiceKey(e.target.value)} required />
          </div>
          <button className="btn" disabled={loading}>{loading ? 'Đang tải...' : 'Xem kết quả AI'}</button>
        </form>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2>{result.jobTitle} · {result.applicationCode}</h2>
            <span className={`badge ${view.cls}`}>{view.label}</span>
          </div>

          <div className="alert info">{result.notice}</div>
          {result.isFallbackMock && (
            <div className="alert warn">
              Đây là <strong>dữ liệu dự phòng</strong>, không phải kết quả AI thật. Lý do: {result.errorMessage || 'AI không khả dụng'}.
            </div>
          )}

          <p className="muted" style={{ marginBottom: 4 }}>Điểm phù hợp tham khảo (CV so với JD)</p>
          <p className="score">{result.matchScore ?? '—'}{result.matchScore != null && <small className="muted" style={{ fontSize: '1rem' }}> / 100</small>}</p>

          <h3 style={{ marginTop: 18 }}>Kỹ năng</h3>
          {result.skills.length ? <div className="chips">{result.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div> : <p className="muted">Không có dữ liệu.</p>}

          <h3>Kinh nghiệm</h3>
          {result.experience.length ? result.experience.map((e, i) => (
            <div className="item" key={i}>
              <strong>{e.title || 'Vị trí chưa rõ'}</strong>{e.company && ` · ${e.company}`}{e.period && ` · ${e.period}`}
              {e.description && <div className="muted">{e.description}</div>}
            </div>
          )) : <p className="muted">Không có dữ liệu.</p>}

          <h3>Học vấn</h3>
          {result.education.length ? result.education.map((e, i) => (
            <div className="item" key={i}><strong>{e.degree || 'Chưa rõ'}</strong>{e.school && ` · ${e.school}`}{e.year && ` · ${e.year}`}</div>
          )) : <p className="muted">Không có dữ liệu.</p>}

          <p className="muted" style={{ marginTop: 16 }}>Trạng thái xử lý nội bộ hiện tại: <strong>{result.internalStatus}</strong></p>

          {needsRetry && (
            <button className="btn secondary" disabled={loading} onClick={() => run(candidatePortalApi.retryAIScreening)}>
              Chạy lại phân tích AI
            </button>
          )}
        </div>
      )}
    </div>
  );
}
