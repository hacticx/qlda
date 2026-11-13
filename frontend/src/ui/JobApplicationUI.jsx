import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { candidatePortalApi } from '../api/candidatePortalApi.js';
import { Loading, ErrorBox } from '../components/Feedback.jsx';

const MAX_CV_BYTES = 10 * 1024 * 1024;
const EMPTY_FORM = { fullName: '', email: '', phone: '', coverLetter: '' };

// UC1.2 — Nộp hồ sơ. Kiểm tra ở client chỉ để tiện cho người dùng; server mới là nơi quyết định.
export default function JobApplicationUI() {
  const { jobCode } = useParams();
  const [job, setJob] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cvFile, setCvFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);          // có giá trị = đã nộp thành công

  useEffect(() => {
    candidatePortalApi.getJobPostingDetail(jobCode).then(setJob).catch((e) => setServerError(e.message));
  }, [jobCode]);

  const onField = (name) => (e) => setForm({ ...form, [name]: e.target.value });

  function onChooseCv(e) {
    const file = e.target.files[0];
    setCvFile(null);
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) return setErrors({ ...errors, cv: 'CV chỉ chấp nhận PDF hoặc DOCX.' });
    if (file.size > MAX_CV_BYTES) return setErrors({ ...errors, cv: 'CV vượt quá 10 MB.' });
    setErrors({ ...errors, cv: undefined });
    setCvFile(file);
  }

  function validate() {
    const found = {};
    if (form.fullName.trim().length < 2) found.fullName = 'Vui lòng nhập họ tên.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) found.email = 'Email không hợp lệ.';
    if (!/^(\+?84|0)\d{9}$/.test(form.phone.replace(/\s/g, ''))) found.phone = 'Số điện thoại không hợp lệ.';
    if (!cvFile) found.cv = 'Vui lòng chọn CV hợp lệ (PDF/DOCX, tối đa 10 MB).';
    return found;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setServerError('');
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const data = new FormData();
    data.append('jobPostingId', job.jobPostingId);
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    data.append('cv', cvFile);

    setSubmitting(true);
    try {
      setResult(await candidatePortalApi.submitApplication(data));
    } catch (err) {
      setServerError(err.message);
      if (err.details) setErrors(err.details);   // lỗi từng trường do server trả về
    } finally {
      setSubmitting(false);
    }
  }

  if (!job && !serverError) return <Loading />;

  // ----- Màn hình thành công: hiển thị mã hồ sơ -----
  if (result) {
    return (
      <div className="narrow">
        <div className="card">
          <div className="alert success">✔ Nộp hồ sơ thành công!</div>
          <p>Hồ sơ ứng tuyển vị trí <strong>{result.jobTitle}</strong> đã được tiếp nhận.</p>
          <p className="muted" style={{ marginBottom: 0 }}>Mã hồ sơ của bạn (vui lòng lưu lại):</p>
          <div className="code-box">{result.applicationCode}</div>
          <p>Trạng thái hiện tại: <strong>{result.statusLabel}</strong></p>
          <p className="muted">Dùng mã hồ sơ cùng email hoặc số điện thoại đã khai báo để tra cứu tiến độ.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="btn" to="/tracking">Tra cứu hồ sơ</Link>
            <Link className="btn secondary" to="/">Xem thêm việc làm</Link>
          </div>
        </div>
      </div>
    );
  }

  // ----- Biểu mẫu -----
  return (
    <div className="narrow">
      <Link className="back" to={`/jobs/${jobCode}`}>← Quay lại chi tiết</Link>
      <div className="card">
        <h1>Ứng tuyển</h1>
        {job && <p className="muted">Vị trí: <strong>{job.title}</strong></p>}
        <ErrorBox message={serverError} />

        {job?.isAcceptingApplications ? (
          <form onSubmit={onSubmit} noValidate>
            <Field id="fullName" label="Họ và tên *" error={errors.fullName}>
              <input id="fullName" type="text" value={form.fullName} onChange={onField('fullName')} />
            </Field>
            <Field id="email" label="Email *" error={errors.email} hint="Email dùng để xác thực khi tra cứu hồ sơ.">
              <input id="email" type="email" value={form.email} onChange={onField('email')} />
            </Field>
            <Field id="phone" label="Số điện thoại *" error={errors.phone}>
              <input id="phone" type="tel" value={form.phone} onChange={onField('phone')} />
            </Field>
            <Field id="cv" label="CV (PDF/DOCX, tối đa 10 MB) *" error={errors.cv}
              hint={cvFile && `Đã chọn: ${cvFile.name} (${Math.round(cvFile.size / 1024)} KB) — chọn lại để thay CV.`}>
              <input id="cv" type="file" accept=".pdf,.docx" onChange={onChooseCv} />
            </Field>
            <Field id="coverLetter" label="Thư giới thiệu (không bắt buộc)">
              <textarea id="coverLetter" rows={4} value={form.coverLetter} onChange={onField('coverLetter')} />
            </Field>
            <button className="btn" disabled={submitting}>{submitting ? 'Đang gửi hồ sơ...' : 'Nộp hồ sơ'}</button>
            {submitting && <p className="hint">Hệ thống đang lưu hồ sơ và đọc CV, vui lòng chờ trong giây lát.</p>}
          </form>
        ) : job && (
          <div className="alert info">Tin tuyển dụng này hiện không nhận hồ sơ.</div>
        )}
      </div>
    </div>
  );
}

// Một ô nhập: nhãn + ô + gợi ý + lỗi
function Field({ id, label, hint, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
