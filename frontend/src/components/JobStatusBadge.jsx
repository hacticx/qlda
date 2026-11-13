// Nhãn trạng thái tin: đang nhận / quá hạn nộp / đã đóng
export default function JobStatusBadge({ job }) {
  if (job.isAcceptingApplications) return <span className="badge open">Đang nhận hồ sơ</span>;
  if (job.status === 'OPEN') return <span className="badge expired">Hết hạn nộp</span>;
  return <span className="badge closed">Đã đóng</span>;
}
