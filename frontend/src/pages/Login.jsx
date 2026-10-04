import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, WrenchScrewdriverIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import ErrorAlert from '../components/common/ErrorAlert';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters.';
  return errors;
}

// Role-based landing page after login.
function getHomeRoute(role) {
  switch (role) {
    case 'technician':
      return '/maintenance-calendar';
    case 'vendor':
      return '/dashboard';
    case 'maintenance_admin':
    case 'operations_manager':
    default:
      return '/dashboard';
  }
}

function readRemembered() {
  try {
    return localStorage.getItem('rememberedEmail') || '';
  } catch {
    return '';
  }
}

export default function Login() {
  const { login, loading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState(() => ({ email: readRemembered(), password: '' }));
  const [remember, setRemember] = useState(() => !!readRemembered());
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [authError, setAuthError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !success) {
      navigate(getHomeRoute(user?.role), { replace: true });
    }
  }, [isAuthenticated, success, user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    setAuthError('');
    if (touched[name]) setErrors(validate(next));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors(validate(form));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setAuthError('');
    try {
      const userData = await login(form.email.trim(), form.password);
      try {
        if (remember) localStorage.setItem('rememberedEmail', form.email.trim());
        else localStorage.removeItem('rememberedEmail');
      } catch {
        /* storage unavailable */
      }
      setSuccess(true);
      const target = location.state?.from?.pathname || getHomeRoute(userData?.role);
      setTimeout(() => navigate(target, { replace: true }), 600);
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        (status === 401 ? 'Invalid email or password.' : null) ||
        (status === 429 ? 'Too many attempts. Please try again later.' : null) ||
        (err?.request && !err?.response ? 'Unable to reach the server. Check your connection.' : null) ||
        'Login failed. Please try again.';
      setAuthError(msg);
    }
  };

  const handleForgot = (e) => {
    e.preventDefault();
    window.alert('Password reset is handled by your administrator. Please contact your Maintenance Admin to reset your password.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-gray-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary-600 flex items-center justify-center shadow-lg">
            <WrenchScrewdriverIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">PhysioGuard</h1>
          <p className="mt-1 text-sm text-gray-500">Smart Asset Maintenance Suite</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900">Sign in to your account</h2>
          <p className="text-sm text-gray-500 mt-1 mb-6">Enter your credentials to continue.</p>

          {authError && (
            <div className="mb-4">
              <ErrorAlert message={authError} />
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4 flex items-center gap-3" role="status">
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800">Signed in successfully. Redirecting...</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={loading || success}
                placeholder="you@clinic.com"
                aria-invalid={!!(touched.email && errors.email)}
                className={`input-field ${touched.email && errors.email ? 'border-red-400' : ''}`}
              />
              {touched.email && errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={loading || success}
                  placeholder="Enter your password"
                  aria-invalid={!!(touched.password && errors.password)}
                  className={`input-field pr-10 ${touched.password && errors.password ? 'border-red-400' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
              {touched.password && errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Remember me
              </label>
              <a href="#forgot" onClick={handleForgot} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Forgot password?
              </a>
            </div>

            <button type="submit" disabled={loading || success} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {loading ? 'Signing in...' : success ? 'Signed in' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} PhysioGuard. Authorized personnel only.
        </p>
      </div>
    </div>
  );
}
