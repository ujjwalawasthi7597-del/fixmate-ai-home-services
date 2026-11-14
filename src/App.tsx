import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { ExploreServicesPage } from './pages/ExploreServicesPage';
import { ProviderDetailPage } from './pages/ProviderDetailPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { BookingFlowPage } from './pages/BookingFlowPage';
import { AuthPage } from './pages/AuthPage';
import { MessagesPage } from './pages/MessagesPage';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { ProviderDashboard } from './pages/ProviderDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import type { UserRole } from './types';

function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    const fallback =
      user.role === 'admin'
        ? '/dashboard/admin'
        : user.role === 'provider'
        ? '/dashboard/provider'
        : '/dashboard/customer';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

function AppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/explore" element={<ExploreServicesPage />} />
          <Route path="/professionals/:id" element={<ProviderDetailPage />} />
          <Route path="/ai-assistant" element={<AIAssistantPage />} />
          <Route path="/book/:providerId" element={<BookingFlowPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route
            path="/messages"
            element={
              <ProtectedRoute allowedRoles={['customer', 'provider', 'admin']}>
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/customer"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/provider"
            element={
              <ProtectedRoute allowedRoles={['provider']}>
                <ProviderDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
