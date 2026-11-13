import { NavLink, Link } from 'react-router-dom';

export default function Layout({ children }) {
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="brand" style={{ textDecoration: 'none' }}>Smart<span>HR</span> · Tuyển dụng</Link>
          <nav className="nav">
            <NavLink to="/" end>Việc làm</NavLink>
            <NavLink to="/tracking">Tra cứu hồ sơ</NavLink>
            <NavLink to="/demo/ai-result">Demo: Kết quả AI (HR)</NavLink>
          </nav>
        </div>
      </header>
      <main className="container">{children}</main>
      <footer className="footer">SmartHR — Module 1: Cổng Ứng viên (bản demo, toàn bộ dữ liệu là giả lập)</footer>
    </>
  );
}
