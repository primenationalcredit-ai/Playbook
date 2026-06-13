import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Headphones, ExternalLink, BarChart3, Users, Clock,
  CheckCircle, Phone, MessageSquare
} from 'lucide-react';

function CSRDashboard() {
  const { currentUser } = useApp();

  const DASHBOARD_URL = 'https://pointscrm.com/asap_dashboard/dashboard';

  // Check if user is customer support
  const isCSR = currentUser?.department === 'customer_support' || currentUser?.role === 'admin';

  if (!isCSR) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          This page is only available to Customer Support team members.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Headphones className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">CSR Dashboard</h1>
            <p className="text-slate-500 text-sm">Customer Support metrics and performance</p>
          </div>
        </div>
      </div>

      {/* Quick Access Card */}
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg p-8 mb-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">PointsCRM Dashboard</h2>
            <p className="text-purple-100 mb-6">
              Access your daily metrics, performance tracking, and customer support analytics.
            </p>
            <a
              href={DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
              Open Dashboard
            </a>
          </div>
          <div className="hidden md:block">
            <BarChart3 className="w-24 h-24 text-purple-300 opacity-50" />
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Call Metrics</h3>
          </div>
          <p className="text-sm text-slate-600">
            Track your daily call volume, average handle time, and resolution rates in the PointsCRM dashboard.
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Performance</h3>
          </div>
          <p className="text-sm text-slate-600">
            Monitor your KPIs, customer satisfaction scores, and compare your performance against team goals.
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Real-Time Data</h3>
          </div>
          <p className="text-sm text-slate-600">
            The dashboard updates in real-time, giving you instant visibility into your current performance metrics.
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Team Comparison</h3>
          </div>
          <p className="text-sm text-slate-600">
            See how you stack up against your teammates and identify areas for improvement.
          </p>
        </div>
      </div>

      {/* Embedded Dashboard (optional - can be enabled if PointsCRM allows embedding) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Quick View</h3>
            <a
              href={DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-asap-blue hover:underline flex items-center gap-1"
            >
              Open in new tab
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="relative" style={{ height: '600px' }}>
          <iframe
            src={DASHBOARD_URL}
            className="absolute inset-0 w-full h-full border-0"
            title="CSR Dashboard"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
          {/* Fallback if iframe doesn't load */}
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
            <div className="text-center">
              <Headphones className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">Dashboard may require login</p>
              <a
                href={DASHBOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-asap-blue text-white rounded-lg pointer-events-auto"
              >
                <ExternalLink className="w-4 h-4" />
                Open Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CSRDashboard;
