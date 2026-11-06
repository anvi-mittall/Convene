import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const validate = () => {
    const errs = {};
    if (!formData.email.trim()) {
      errs.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errs.email = 'Valid email is required';
    }
    if (!formData.password) {
      errs.password = 'Password is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await login(formData.email, formData.password);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Login failed';
      setServerError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid grid-cols-1 md:grid-cols-2">
      {/* Left Panel: Lavender Split Screen */}
      <div className="bg-[#C9B6FF] border-b-2 md:border-b-0 md:border-r-2 border-[#2B2340] p-8 sm:p-12 lg:p-16 flex flex-col justify-between min-h-[320px] md:min-h-full">
        <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]">
          WORKSHOP/HUB
        </div>

        <div className="my-10 md:my-0">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-[#2B2340] tracking-tight leading-[1.08]">
            Your seat is<br />
            waiting.
          </h1>
        </div>

        <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/80">
          SCAN IN · LEARN · COLLECT THE CERTIFICATE
        </div>
      </div>

      {/* Right Panel: Sign In Form */}
      <div className="bg-[#FFF4EC] flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md">
          <h2 className="text-3xl sm:text-4xl font-black text-[#2B2340] tracking-tight mb-8">
            Sign in
          </h2>

          {serverError && (
            <div className="mb-6 p-3.5 bg-[#FFB3C7] border-2 border-[#2B2340] font-mono text-xs uppercase font-bold text-[#2B2340]">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-1.5">
                EMAIL
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@example.com"
                className="input-base"
              />
              {errors.email && (
                <p className="mt-1.5 font-mono text-xs font-semibold text-[#2B2340] underline">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block font-mono text-xs uppercase tracking-wider font-bold text-[#2B2340] mb-1.5">
                PASSWORD
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="input-base"
              />
              {errors.password && (
                <p className="mt-1.5 font-mono text-xs font-semibold text-[#2B2340] underline">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-base font-extrabold mt-6"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t-2 border-[#2B2340]/20">
            <Link
              to="/signup"
              className="font-mono text-xs font-bold text-[#2B2340] underline decoration-2 underline-offset-4 hover:bg-[#FFB3C7] px-1 py-0.5"
            >
              New here? Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
