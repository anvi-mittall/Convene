import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchCurrentUser, loginUser, registerUser } from '../api/auth.js';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('convene_token');
    localStorage.removeItem('convene_user');
    setUser(null);
  }, []);

  const restoreSession = useCallback(async () => {
    const token = localStorage.getItem('convene_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetchCurrentUser();
      if (res.success && res.data) {
        setUser(res.data);
        localStorage.setItem('convene_user', JSON.stringify(res.data));
      } else {
        logout();
      }
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    restoreSession();

    const handleUnauthorized = () => {
      logout();
      toast.error('Session expired. Please log in again.');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [restoreSession, logout]);

  const login = async (email, password) => {
    const res = await loginUser({ email, password });
    if (res.success && res.data) {
      const { user: userData, token } = res.data;
      localStorage.setItem('convene_token', token);
      localStorage.setItem('convene_user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    }
    throw new Error(res.error?.message || 'Login failed');
  };

  const register = async (name, email, password) => {
    const res = await registerUser({ name, email, password });
    if (res.success && res.data) {
      const { user: userData, token } = res.data;
      localStorage.setItem('convene_token', token);
      localStorage.setItem('convene_user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    }
    throw new Error(res.error?.message || 'Registration failed');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
