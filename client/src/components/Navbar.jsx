import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { LogOut, Menu, X } from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navLinkClass = (path) =>
    `font-mono uppercase text-[12px] tracking-[0.06em] font-medium transition-colors px-2 py-1 ${
      isActive(path)
        ? 'text-[#2B2340] underline decoration-2 underline-offset-4 font-bold'
        : 'text-[#2B2340]/80 hover:text-[#2B2340] hover:underline decoration-2 underline-offset-4'
    }`;

  return (
    <nav className="sticky top-0 z-40 bg-[#FFF4EC] border-b-2 border-[#2B2340]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Nav links */}
          <div className="flex items-center gap-8">
            <Link to="/" className="inline-block transform -rotate-2 hover:rotate-0 transition-transform">
              <span className="bg-[#2B2340] text-[#FFF4EC] font-extrabold text-base tracking-wider px-2.5 py-1 inline-block border-2 border-[#2B2340]">
                WORKSHOP/HUB
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link to="/" className={navLinkClass('/')}>
                EVENTS
              </Link>

              {user && (
                <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                  MY TICKETS
                </Link>
              )}

              {(user?.role === 'organizer' || user?.role === 'admin') && (
                <Link to="/organizer" className={navLinkClass('/organizer')}>
                  ORGANIZE
                </Link>
              )}

              {user?.role === 'admin' && (
                <Link to="/admin" className={navLinkClass('/admin')}>
                  ADMIN
                </Link>
              )}
            </div>
          </div>

          {/* User profile / Auth buttons */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[#2B2340]">{user.name}</span>
                  <StatusBadge status={user.role} type="role" />
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="btn-secondary min-h-[38px] px-3 py-1 text-xs"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  <span>SIGN OUT</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="btn-primary min-h-[44px] px-6 text-sm"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 border-2 border-[#2B2340] bg-white text-[#2B2340] hover:bg-[#FFB3C7] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-3 pb-5 space-y-3 bg-[#FFF4EC] border-t-2 border-[#2B2340]">
          <div className="flex flex-col space-y-2">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="font-mono uppercase text-xs tracking-wider font-semibold py-2 px-3 border-2 border-[#2B2340] bg-white text-[#2B2340]"
            >
              EVENTS
            </Link>

            {user && (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="font-mono uppercase text-xs tracking-wider font-semibold py-2 px-3 border-2 border-[#2B2340] bg-white text-[#2B2340]"
              >
                MY TICKETS
              </Link>
            )}

            {(user?.role === 'organizer' || user?.role === 'admin') && (
              <Link
                to="/organizer"
                onClick={() => setMobileMenuOpen(false)}
                className="font-mono uppercase text-xs tracking-wider font-semibold py-2 px-3 border-2 border-[#2B2340] bg-white text-[#2B2340]"
              >
                ORGANIZE
              </Link>
            )}

            {user?.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="font-mono uppercase text-xs tracking-wider font-semibold py-2 px-3 border-2 border-[#2B2340] bg-white text-[#2B2340]"
              >
                ADMIN
              </Link>
            )}
          </div>

          <div className="pt-3 border-t-2 border-[#2B2340]">
            {user ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-[#2B2340]">{user.name}</div>
                  <div className="font-mono text-[11px] text-[#2B2340]/70">{user.email}</div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="btn-secondary min-h-[38px] px-3 py-1 text-xs"
                >
                  SIGN OUT
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-primary flex-1 text-center"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-secondary flex-1 text-center"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
