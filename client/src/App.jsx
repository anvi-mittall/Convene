import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';

import { HomePage } from './pages/HomePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { EventDetailPage } from './pages/EventDetailPage.jsx';
import { OrganizerEventsPage } from './pages/OrganizerEventsPage.jsx';
import { OrganizerEventFormPage } from './pages/OrganizerEventFormPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';

import { OrganizerManagePage } from './pages/OrganizerManagePage.jsx';

import { AdminPage } from './pages/AdminPage.jsx';

// Guest-only route wrapper so logged in users don't see login/signup
function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export function AppContent() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FFF4EC] text-[#2B2340]">
      <Navbar />
      <main className="flex-1">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />

          {/* Guest routes */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <GuestRoute>
                <SignupPage />
              </GuestRoute>
            }
          />

          {/* Attendee Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer"
            element={
              <ProtectedRoute roles={['organizer', 'admin']}>
                <OrganizerEventsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizer/events/new"
            element={
              <ProtectedRoute roles={['organizer', 'admin']}>
                <OrganizerEventFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizer/events/:id/edit"
            element={
              <ProtectedRoute roles={['organizer', 'admin']}>
                <OrganizerEventFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizer/events/:id/manage"
            element={
              <ProtectedRoute roles={['organizer', 'admin']}>
                <OrganizerManagePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* 404 Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            color: '#2B2340',
            border: '2px solid #2B2340',
            boxShadow: '4px 4px 0px #2B2340',
            borderRadius: '0px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '13px'
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
