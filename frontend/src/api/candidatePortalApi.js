// Nơi DUY NHẤT frontend gọi backend. Lỗi được chuẩn hóa thành Error có { code, details }.
async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    throw Object.assign(new Error('Không kết nối được máy chủ. Vui lòng thử lại sau.'), { code: 'NETWORK' });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body.error || {};
    throw Object.assign(new Error(err.message || 'Có lỗi xảy ra.'), { code: err.code, details: err.details });
  }
  return body.data;
}

export const candidatePortalApi = {
  // UC1.1
  getOpenJobPostings: (keyword = '') => request(`/job-postings?q=${encodeURIComponent(keyword)}`),
  getJobPostingDetail: (jobCode) => request(`/job-postings/${encodeURIComponent(jobCode)}`),
  // UC1.2 — formData: jobPostingId, fullName, email, phone, coverLetter, cv (file)
  submitApplication: (formData) => request('/applications', { method: 'POST', body: formData }),
  // UC1.3
  trackApplication: ({ applicationCode, contactInfo }) =>
    request('/applications/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationCode, contactInfo }),
    }),

  // ----- API NỘI BỘ (phía HR/module khác — cần khóa dịch vụ) -----
  getAIScreeningResult: (applicationCode, serviceKey) =>
    request(`/internal/applications/${encodeURIComponent(applicationCode)}/ai-screening`, { headers: { 'x-service-key': serviceKey } }),
  retryAIScreening: (applicationCode, serviceKey) =>
    request(`/internal/applications/${encodeURIComponent(applicationCode)}/ai-screening/retry`, { method: 'POST', headers: { 'x-service-key': serviceKey } }),
};
