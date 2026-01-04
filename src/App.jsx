import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyPlaybook from './pages/MyPlaybook';
import TeamView from './pages/TeamView';
import Updates from './pages/Updates';
import AdminTasks from './pages/AdminTasks';
import AdminUsers from './pages/AdminUsers';
import AdminUpdates from './pages/AdminUpdates';
import AdminTraining from './pages/AdminTraining';
import AdminTrainingCourse from './pages/AdminTrainingCourse';
import Training from './pages/Training';
import TrainingCourse from './pages/TrainingCourse';
import Reviews from './pages/Reviews';
import ConsultantPayments from './pages/ConsultantPayments';
import CSRDashboard from './pages/CSRDashboard';
import Paysheet from './pages/Paysheet';
import AskAI from './pages/AskAI';
import AdminKnowledge from './pages/AdminKnowledge';
import Calendar from './pages/Calendar';
import AdminPTO from './pages/AdminPTO';
import AdminOnboarding from './pages/AdminOnboarding';
import Onboarding from './pages/Onboarding';
import AdminScorecards from './pages/AdminScorecards';
import Scorecards from './pages/Scorecards';
import Affiliates from './pages/Affiliates';
import FinancialDashboard from './pages/FinancialDashboard';

function ProtectedRoute({ children, adminOnly = false }) {
  const { currentUser, loading } = useApp();
  
  // Wait for auth to load before making decisions
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-asap-blue/30 border-t-asap-blue rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && currentUser.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function App() {
  const { currentUser, loading } = useApp();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-asap-blue/30 border-t-asap-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        currentUser ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="playbook" element={<MyPlaybook />} />
        <Route path="team" element={<TeamView />} />
        <Route path="updates" element={<Updates />} />
        <Route path="training" element={<Training />} />
        <Route path="training/:courseId" element={<TrainingCourse />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="payments" element={<ConsultantPayments />} />
        <Route path="paysheet" element={<Paysheet />} />
        <Route path="csr-dashboard" element={<CSRDashboard />} />
        <Route path="ask-ai" element={<AskAI />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="scorecards" element={<Scorecards />} />
        <Route path="affiliates" element={<Affiliates />} />
        
        {/* Admin Routes */}
        <Route path="admin/tasks" element={
          <ProtectedRoute adminOnly>
            <AdminTasks />
          </ProtectedRoute>
        } />
        <Route path="admin/users" element={
          <ProtectedRoute adminOnly>
            <AdminUsers />
          </ProtectedRoute>
        } />
        <Route path="admin/updates" element={
          <ProtectedRoute adminOnly>
            <AdminUpdates />
          </ProtectedRoute>
        } />
        <Route path="admin/training" element={
          <ProtectedRoute adminOnly>
            <AdminTraining />
          </ProtectedRoute>
        } />
        <Route path="admin/training/:courseId" element={
          <ProtectedRoute adminOnly>
            <AdminTrainingCourse />
          </ProtectedRoute>
        } />
        <Route path="admin/knowledge" element={
          <ProtectedRoute adminOnly>
            <AdminKnowledge />
          </ProtectedRoute>
        } />
        <Route path="admin/pto" element={
          <ProtectedRoute adminOnly>
            <AdminPTO />
          </ProtectedRoute>
        } />
        <Route path="admin/onboarding" element={
          <ProtectedRoute adminOnly>
            <AdminOnboarding />
          </ProtectedRoute>
        } />
        <Route path="admin/scorecards" element={
          <ProtectedRoute adminOnly>
            <AdminScorecards />
          </ProtectedRoute>
        } />
        <Route path="admin/financials" element={
          <ProtectedRoute adminOnly>
            <FinancialDashboard />
          </ProtectedRoute>
        } />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
