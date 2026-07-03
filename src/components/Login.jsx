import { useEffect, useState } from 'react';
import '../styles/login.css';

export default function Login({ onLogin, loading, error, theme, onToggleTheme }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState(() =>
    sessionStorage.getItem('pos_login_throttled') === 'warned' ? 'still-restricted' : ''
  );
  const [showPass, setShowPass] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const intervalId = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(intervalId);
          setFormError('retry-now');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [countdown]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (countdown > 0) return;
    setFormError('loading');
    try {
      await onLogin(username, password);
      sessionStorage.removeItem('pos_login_throttled');
    } catch (err) {
      const code = err.code || '';
      const msg = err.message || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setFormError('Incorrect username or password. Please try again.');
      } else if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
        if (sessionStorage.getItem('pos_login_throttled') === 'warned') {
          // Already waited once; keep the user from retry-looping during temporary lockout.
          setFormError('still-restricted');
        } else {
          sessionStorage.setItem('pos_login_throttled', 'warned');
          setCountdown(60);
          setFormError('too-many-requests');
        }
      } else if (code === 'auth/user-disabled') {
        setFormError('This account has been disabled. Contact your administrator.');
      } else if (msg) {
        // Show our own custom error messages (deactivated account, etc.)
        setFormError(msg);
      } else {
        setFormError('Unable to sign in. Please check your credentials and try again.');
      }
    }
  };

  return (
    <div className="login-page d-flex align-items-center justify-content-center min-vh-100">
      <div className="login-card">
        <button
          type="button"
          className="theme-toggle login-theme-toggle"
          onClick={onToggleTheme}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`}></i>
        </button>
        {/* Logo */}
        <div className="text-center mb-4">
          <div className="store-logo mb-2">
            <i className="bi bi-shop-window"></i>
          </div>
          <h1 className="store-name">CARREN'S STORE</h1>
          <p className="store-sub">Point of Sale System</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} autoComplete="off">
          {(formError || error) && formError !== 'loading' && (
            formError === 'too-many-requests' ? (
              <div className="alert alert-warning d-flex align-items-start gap-2 py-2" role="alert">
                <i className="bi bi-clock-history flex-shrink-0 mt-1"></i>
                <div>
                  <div className="fw-semibold" style={{ fontSize: '0.85rem' }}>Too many failed attempts.</div>
                  <div style={{ fontSize: '0.8rem' }}>Please wait <strong>{countdown}s</strong> before trying again.</div>
                  <div className="mt-1" style={{ height: 4, background: 'rgba(0,0,0,0.1)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${(countdown / 60) * 100}%`, background: '#f59e0b', borderRadius: 2, transition: 'width 1s linear' }}></div>
                  </div>
                </div>
              </div>
            ) : formError === 'retry-now' ? (
              <div className="alert alert-info d-flex align-items-center gap-2 py-2" role="alert">
                <i className="bi bi-check-circle-fill"></i>
                <small>You may now try signing in again.</small>
              </div>
            ) : formError === 'still-restricted' ? (
              <div className="alert alert-warning d-flex align-items-start gap-2 py-2" role="alert">
                <i className="bi bi-shield-exclamation flex-shrink-0 mt-1"></i>
                <div>
                  <div className="fw-semibold" style={{ fontSize: '0.85rem' }}>Access is still temporarily restricted.</div>
                  <div style={{ fontSize: '0.8rem' }}>Too many failed attempts were recorded. Please wait a few minutes and try again.</div>
                </div>
              </div>
            ) : (
              <div className="alert alert-danger d-flex align-items-center gap-2 py-2" role="alert">
                <i className="bi bi-exclamation-circle-fill"></i>
                <small>{formError || error}</small>
              </div>
            )
          )}
          <div className="mb-3">
            <label className="form-label fw-semibold">Username</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-person text-secondary"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="form-label fw-semibold">Password</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-lock text-secondary"></i>
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                className="form-control border-start-0 border-end-0 ps-0"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="input-group-text bg-light"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'} text-secondary`}></i>
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-100 login-btn" disabled={loading || countdown > 0}>
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Signing in...</>
              : countdown > 0
                ? <><i className="bi bi-clock me-2"></i>Wait {countdown}s</>
                : <><i className="bi bi-box-arrow-in-right me-2"></i>Sign In</>
            }
          </button>
        </form>

        <p className="text-center text-muted mt-4 mb-0" style={{ fontSize: '0.75rem' }}>
          <i className="bi bi-shield-lock me-1"></i>
          Secure POS v1.0
        </p>
      </div>
    </div>
  );
}
