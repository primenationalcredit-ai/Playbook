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
import IncomingReviews from './pages/IncomingReviews';
import ClaimReviews from './pages/ClaimReviews';
import ReviewRandomizer from './pages/ReviewRandomizer';
import ConsultantPayments from './pages/ConsultantPayments';
import AllPayments from './pages/AllPayments';
import Invoices from './pages/Invoices';
import Agreements from './pages/Agreements';
import Approvals from './pages/Approvals';
import SecuredCards from './pages/SecuredCards';
import CSRDashboard from './pages/CSRDashboard';
import Paysheet from './pages/Paysheet';
import AskAI from './pages/AskAI';
import AdminKnowledge from './pages/AdminKnowledge';
import KnowledgeAssistant from './pages/KnowledgeAssistant';
import CompanyProfile from './pages/CompanyProfile';
import AITrainingHub from './pages/AITrainingHub';
import AdminSurveys from './pages/AdminSurveys';
import Calendar from './pages/Calendar';
import AdminPTO from './pages/AdminPTO';
import AdminOnboarding from './pages/AdminOnboarding';
import Onboarding from './pages/Onboarding';
import Scorecards from './pages/Scorecards';
import Affiliates from './pages/Affiliates';
import FinancialDashboard from './pages/FinancialDashboard';
import Settings from './pages/Settings';
import LeadershipProjects from './pages/LeadershipProjects';
import QuickLinks from './pages/QuickLinks';
import BackupSettings from './pages/BackupSettings';
import DOOPaysheet from './pages/DOOPaysheet';
import ConsultantBonus from './pages/ConsultantBonus';
import AMBonus from './pages/AMBonus';
import BonusTracker from './pages/BonusTracker';
import ClientPipeline from './pages/ClientPipeline';
import EnrollmentSurvey from './pages/EnrollmentSurvey';
import CompletionSurvey from './pages/CompletionSurvey';
import Round2Survey from './pages/Round2Survey';
import RefundTracking from './pages/RefundTracking';

function ProtectedRoute({ children, adminOnly = false, noRestrictedLeaders = false }) {
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
  
  // Block Kim and Mariana from restricted pages (Financials, DOO Compensation)
  // Using IDs to prevent bypass via name change
  if (noRestrictedLeaders) {
    const RESTRICTED_LEADER_IDS = [
      'f7b8bc3a-74e6-46c2-a378-d19d204d7133', // Mariana Navarro
      '3ae5ad73-46eb-404f-8dc9-6d5cf53e9df0', // Kim Sanchez
    ];
    if (RESTRICTED_LEADER_IDS.includes(currentUser?.id)) {
      return <Navigate to="/dashboard" replace />;
    }
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
      {/* PUBLIC SURVEY ROUTES - No authentication required */}
      <Route path="/survey/enrollment" element={<EnrollmentSurvey />} />
      <Route path="/survey/completion" element={<CompletionSurvey />} />
      <Route path="/survey/round2" element={<Round2Survey />} />
      
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
        <Route path="incoming-reviews" element={<IncomingReviews />} />
        <Route path="claim-reviews" element={<ClaimReviews />} />
        <Route path="review-link" element={<ReviewRandomizer />} />
        <Route path="payments" element={<ConsultantPayments />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="agreements" element={<Agreements />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="approvals/:id" element={<Approvals />} />
        <Route path="admin/all-payments" element={<ConsultantPayments />} />
        <Route path="secured-cards" element={<SecuredCards />} />
        <Route path="paysheet" element={<Paysheet />} />
        <Route path="csr-dashboard" element={<CSRDashboard />} />
        <Route path="ask-ai" element={<AskAI />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="scorecards" element={<Scorecards />} />
        <Route path="bonus-tracker" element={<BonusTracker />} />
        <Route path="am-bonus-tracker" element={<BonusTracker />} />
        <Route path="affiliates" element={<Affiliates />} />
        <Route path="settings" element={<Settings />} />
        <Route path="projects" element={<LeadershipProjects />} />
        <Route path="quick-links" element={<QuickLinks />} />
        
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
        <Route path="admin/knowledge/assistant" element={
          <ProtectedRoute adminOnly>
            <KnowledgeAssistant />
          </ProtectedRoute>
        } />
        <Route path="admin/company-profile" element={
          <ProtectedRoute adminOnly>
            <CompanyProfile />
          </ProtectedRoute>
        } />
        <Route path="admin/ai-learning" element={
          <ProtectedRoute adminOnly>
            <AITrainingHub />
          </ProtectedRoute>
        } />
        <Route path="admin/surveys" element={
          <ProtectedRoute adminOnly>
            <AdminSurveys />
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
        <Route path="admin/financials" element={
          <ProtectedRoute adminOnly noRestrictedLeaders>
            <FinancialDashboard />
          </ProtectedRoute>
        } />
        <Route path="admin/backups" element={
          <ProtectedRoute adminOnly>
            <BackupSettings />
          </ProtectedRoute>
        } />
        <Route path="admin/doo-paysheet" element={
          <ProtectedRoute adminOnly noRestrictedLeaders>
            <DOOPaysheet />
          </ProtectedRoute>
        } />
        <Route path="admin/refunds" element={
          <ProtectedRoute adminOnly>
            <RefundTracking />
          </ProtectedRoute>
        } />
        <Route path="admin/pipeline" element={
          <ProtectedRoute adminOnly>
            <ClientPipeline />
          </ProtectedRoute>
        } />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
