import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import JobListingUI from './ui/JobListingUI.jsx';
import JobApplicationUI from './ui/JobApplicationUI.jsx';
import ApplicationTrackingUI from './ui/ApplicationTrackingUI.jsx';
import AIResultDemoUI from './ui/AIResultDemoUI.jsx';

// 3 màn hình Boundary của Cổng Ứng viên (theo sơ đồ lớp phân tích)
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<JobListingUI />} />                       {/* UC1.1: danh sách */}
        <Route path="/jobs/:jobCode" element={<JobListingUI />} />          {/* UC1.1: chi tiết JD */}
        <Route path="/jobs/:jobCode/apply" element={<JobApplicationUI />} />{/* UC1.2 */}
        <Route path="/tracking" element={<ApplicationTrackingUI />} />      {/* UC1.3 */}
        <Route path="/demo/ai-result" element={<AIResultDemoUI />} />      {/* CHỈ DEMO: phía HR (M3) */}
        <Route path="*" element={<p>Không tìm thấy trang.</p>} />
      </Routes>
    </Layout>
  );
}
