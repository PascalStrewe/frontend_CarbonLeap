import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login, Register } from './components/auth-pages';
import Dashboard from './components/carbon-dashboard';
import InterventionRequest from './components/intervention-request';
import ReportingPage from './components/reporting-page';
import AdminUpload from './components/admin-upload';
import AnalyticsPage from './components/analytics-page';
import { AuthProvider, useAuth } from './context/AuthContext';
import { InterventionProvider } from './context/InterventionContext';
import CarbonTransfer from './components/carbon-transfer';
import PartnershipManagement from './components/partnership-management';
import ChatWithData from './components/chat-with-data';
import CarbonClaims from './components/claims';

const LoadingScreen = () => (
  <div className="min-h-screen bg-[#DAE9E6] flex items-center justify-center">
    <div className="text-[#103D5E]">Loading...</div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  if (!user?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" /> : <Login />} 
      />
      
      <Route 
        path="/register" 
        element={user ? <Navigate to="/dashboard" /> : <Register />} 
      />
      
      {/* Protected routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/request" 
        element={
          <ProtectedRoute>
            <InterventionRequest />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/claims" 
        element={
          <ProtectedRoute>
            <CarbonClaims />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/reports" 
        element={
          <ProtectedRoute>
            <ReportingPage />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/analytics" 
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/partnerships" 
        element={
          <ProtectedRoute>
            <PartnershipManagement />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/transfers" 
        element={
          <ProtectedRoute>
            <CarbonTransfer />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/chat-with-data" 
        element={
          <ProtectedRoute>
            <ChatWithData />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/pending" 
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-[#DAE9E6] p-8">
              <h1 className="text-2xl font-bold text-[#103D5E]">
                Pending Requests Coming Soon
              </h1>
            </div>
          </ProtectedRoute>
        } 
      />
      
      {/* Admin routes */}
      <Route 
        path="/admin/upload" 
        element={
          <AdminRoute>
            <AdminUpload />
          </AdminRoute>
        } 
      />
      
      {/* Root redirect */}
      <Route 
        path="/" 
        element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} 
      />
      
      {/* 404 route */}
      <Route 
        path="*" 
        element={
          <div className="min-h-screen bg-[#DAE9E6] flex items-center justify-center">
            <div className="text-[#103D5E] text-xl">Page not found</div>
          </div>
        } 
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <InterventionProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </InterventionProvider>
    </AuthProvider>
  );
}

export default App;