import { useState } from 'react';
import { candidatePortalApi } from '../api/candidatePortalApi.js';
import ProgressStepper from '../components/ProgressStepper.jsx';
import { ErrorBox } from '../components/Feedback.jsx';
import { formatDate } from '../utils/format.js';

// UC1.3 — Tra cứu tiến độ bằng mã hồ sơ + thông tin xác thực (email hoặc số điện thoại)
export default function ApplicationTrackingUI() {
  const [form, setForm] = useState({ applicationCode: '', contactInfo: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      setResult(await candidatePortalApi.trackApplication(form));
    } catch (err) {
      setError(err.message);   // ứng viên có thể nhập lại ngay
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="narrow">
      <div className="card">
        <h1>Tra cứu tiến độ hồ sơ</h1>
        <p className="muted">Nhập mã hồ sơ và email (hoặc số điện thoại) đã dùng khi ứng tuyển.</p>
        <ErrorBox message={error} />
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="applicationCode">Mã hồ sơ</label>
            <input id="applicationCode" type="text" placeholder="VD: APP-2026-0001" required
              value={form.applicationCode} onChange={(e) => setForm({ ...form, applicationCode: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="contactInfo">Email hoặc số điện thoại</label>
            <input id="contactInfo" type="text" required
              value={form.contactInfo} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })} />
          </div>
          <button className="btn" disabled={loading}>{loading ? 'Đang tra cứu...' : 'Tra cứu'}</button>
        </form>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 18 }}>
          <h2>{result.jobTitle}</h2>
          <p className="muted">Mã hồ sơ: {result.applicationCode} · Nộp ngày {formatDate(result.appliedAt)}</p>
          <ProgressStepper steps={result.steps} current={result.publicStatus} />
          <div className="alert info" style={{ marginTop: 16, marginBottom: 0 }}>
            <strong>{result.statusLabel}</strong> — {result.statusHint}
          </div>
        </div>
      )}
    </div>
  );
}
