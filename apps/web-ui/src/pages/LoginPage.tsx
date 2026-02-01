import { useEffect } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { Navigate } from 'react-router-dom';
import './LoginPage.css';

export default function LoginPage() {
  const { keycloak, initialized } = useKeycloak();

  useEffect(() => {
    if (initialized && !keycloak.authenticated) {
      keycloak.login();
    }
  }, [initialized, keycloak]);

  if (!initialized) {
    return (
      <div className="login-page">
        <div className="loading">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (keycloak.authenticated) {
    return <Navigate to="/" />;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Video Topic Graph Platform</h1>
        <p>Redirecting to login...</p>
      </div>
    </div>
  );
}
