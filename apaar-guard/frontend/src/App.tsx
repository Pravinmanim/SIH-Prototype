import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LanguageProvider } from './i18n/LanguageContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { ToastProvider } from './components/ui/Toast';
import { Skeleton } from './components/ui/Skeleton';

// Code splitting & lazy loading for pages
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const StudentsPage = lazy(() => import('./pages/StudentsPage').then(m => ({ default: m.StudentsPage })));
const BulkImportPage = lazy(() => import('./pages/BulkImportPage').then(m => ({ default: m.BulkImportPage })));
const VerificationPage = lazy(() => import('./pages/VerificationPage').then(m => ({ default: m.VerificationPage })));
const IntakePage = lazy(() => import('./pages/IntakePage').then(m => ({ default: m.IntakePage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const AuditPage = lazy(() => import('./pages/AuditPage').then(m => ({ default: m.AuditPage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then(m => ({ default: m.HelpPage })));
const ToolsPage = lazy(() => import('./pages/ToolsPage').then(m => ({ default: m.ToolsPage })));
const RulesPage = lazy(() => import('./pages/RulesPage').then(m => ({ default: m.RulesPage })));
const InstitutionSettingsPage = lazy(() => import('./pages/InstitutionSettingsPage').then(m => ({ default: m.InstitutionSettingsPage })));

const PageLoadingFallback = () => (
  <div className="space-y-6 animate-pulse p-2">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
    <div className="h-72 w-full rounded-2xl bg-slate-100/70 border border-slate-200/60" />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ 
  children, 
  adminOnly = false 
}) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F8FC] text-slate-500 text-sm">
        Authenticating session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route 
                  path="dashboard" 
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <DashboardPage />
                    </Suspense>
                  } 
                />
                <Route 
                  path="students" 
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <StudentsPage />
                    </Suspense>
                  } 
                />
                <Route 
                  path="import" 
                  element={
                    <ProtectedRoute adminOnly>
                      <Suspense fallback={<PageLoadingFallback />}>
                        <BulkImportPage />
                      </Suspense>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="verification" 
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <VerificationPage />
                    </Suspense>
                  } 
                />
                <Route 
                  path="intake" 
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <IntakePage />
                    </Suspense>
                  } 
                />
                <Route 
                  path="reports" 
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <ReportsPage />
                    </Suspense>
                  } 
                />
                <Route 
                  path="audit" 
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <AuditPage />
                    </Suspense>
                  } 
                />
                <Route 
                  path="help" 
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <HelpPage />
                    </Suspense>
                  } 
                />
                <Route 
                  path="tools" 
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <ToolsPage />
                    </Suspense>
                  } 
                />
                <Route 
                  path="rules" 
                  element={
                    <Suspense fallback={<PageLoadingFallback />}>
                      <RulesPage />
                    </Suspense>
                  } 
                />
                <Route 
                  path="settings" 
                  element={
                    <ProtectedRoute adminOnly>
                      <Suspense fallback={<PageLoadingFallback />}>
                        <InstitutionSettingsPage />
                      </Suspense>
                    </ProtectedRoute>
                  } 
                />
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
