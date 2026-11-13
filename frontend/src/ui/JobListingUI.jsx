import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { candidatePortalApi } from '../api/candidatePortalApi.js';
import JobStatusBadge from '../components/JobStatusBadge.jsx';
import { Loading, ErrorBox } from '../components/Feedback.jsx';
import { formatDate } from '../utils/format.js';

// UC1.1 — Xem tin tuyển dụng. Có jobCode trên URL → hiện chi tiết; không có → hiện danh sách.
export default function JobListingUI() {
  const { jobCode } = useParams();
  return jobCode ? <JobDetail jobCode={jobCode} /> : <JobList />;
}

function JobList() {
  const [jobs, setJobs] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {   // chờ người dùng gõ xong rồi mới gọi API
      candidatePortalApi.getOpenJobPostings(keyword).then(setJobs).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [keyword]);

  return (
    <>
      <section className="hero">
        <h1>Cơ hội nghề nghiệp tại SmartHR</h1>
        <p>Tìm vị trí phù hợp, nộp hồ sơ trực tuyến và theo dõi tiến độ bằng mã hồ sơ.</p>
      </section>

      <div className="toolbar">
        <input className="grow" type="search" placeholder="Tìm theo tên vị trí, địa điểm..." value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </div>

      <ErrorBox message={error} />
      {!jobs && !error && <Loading />}
      {jobs?.length === 0 && <div className="card muted">Hiện chưa có vị trí phù hợp.</div>}

      <div className="grid">
        {jobs?.map((job) => (
          <article key={job.jobPostingId} className="card job-card">
            <div className="row">
              <h3><Link to={`/jobs/${job.jobCode}`}>{job.title}</Link></h3>
              <JobStatusBadge job={job} />
            </div>
            <div className="meta">
              <span>📍 {job.workLocation}</span>
              <span>⏰ Hạn nộp: {formatDate(job.applicationDeadline)}</span>
            </div>
            <Link className="btn secondary" to={`/jobs/${job.jobCode}`}>Xem chi tiết</Link>
          </article>
        ))}
      </div>
    </>
  );
}

function JobDetail({ jobCode }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setJob(null);
    candidatePortalApi.getJobPostingDetail(jobCode).then(setJob).catch((e) => setError(e.message));
  }, [jobCode]);

  if (error) return <><Link className="back" to="/">← Quay lại danh sách</Link><ErrorBox message={error} /></>;
  if (!job) return <Loading />;

  return (
    <>
      <Link className="back" to="/">← Quay lại danh sách</Link>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h1>{job.title}</h1>
          <JobStatusBadge job={job} />
        </div>
        <p className="muted">Mã tin: {job.jobCode} · 📍 {job.workLocation} · Hạn nộp: {formatDate(job.applicationDeadline)}</p>

        <h2>Mô tả công việc</h2>
        <p className="pre">{job.jobDescription}</p>
        <h2>Yêu cầu</h2>
        <p className="pre">{job.jobRequirements}</p>

        {/* Luồng 6A1: tin đóng/hết hạn → chỉ xem, khóa nút ứng tuyển (server vẫn kiểm tra lại khi nộp) */}
        {job.isAcceptingApplications ? (
          <Link className="btn" to={`/jobs/${job.jobCode}/apply`}>Ứng tuyển ngay</Link>
        ) : (
          <div className="alert info">Tin tuyển dụng này hiện không nhận hồ sơ.</div>
        )}
      </div>
    </>
  );
}
