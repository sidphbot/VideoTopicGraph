import { Outlet, Link, useLocation } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import './Layout.css';

export default function Layout() {
  const { keycloak } = useKeycloak();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/videos', label: 'Videos' },
    { path: '/search', label: 'Search' },
    { path: '/exports', label: 'Exports' },
  ];

  return (
    <div className="layout">
      <header className="header">
        <div className="container header-content">
          <Link to="/" className="logo">
            Video Topic Graph
          </Link>
          <nav className="nav">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="user-menu">
            <span className="user-name">
              {keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username}
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => keycloak.logout()}
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>
      <footer className="footer">
        <div className="container">
          <p>Video Topic Graph Platform &copy; 2024</p>
        </div>
      </footer>
    </div>
  );
}
