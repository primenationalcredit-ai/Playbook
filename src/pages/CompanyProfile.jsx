import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Building, Save, Loader, Check, Plus, X, Edit2, 
  MapPin, Calendar, Users, DollarSign, Star, FileText,
  Phone, Mail, Globe, Sparkles
} from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const DEFAULT_PROFILE = {
  company_name: 'ASAP Credit Repair USA',
  tagline: '',
  founded_year: '2013',
  location: '',
  phone: '',
  email: '',
  website: '',
  
  // What makes us different
  unique_value: '',
  process_summary: '',
  
  // Stats
  clients_helped: '',
  reviews_count: '',
  years_in_business: '',
  
  // Pricing overview
  pricing_summary: '',
  
  // Team
  team_summary: '',
  
  // What we can/can't promise
  compliance_notes: '',
  
  // Anything else the AI should know
  additional_context: ''
};

const SECTIONS = [
  { 
    id: 'basic', 
    title: 'Basic Info', 
    icon: Building,
    fields: [
      { key: 'company_name', label: 'Company Name', type: 'text' },
      { key: 'tagline', label: 'Tagline/Slogan', type: 'text', placeholder: 'e.g., "Your partner in credit recovery"' },
      { key: 'founded_year', label: 'Founded Year', type: 'text' },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g., Phoenix, AZ' },
    ]
  },
  {
    id: 'contact',
    title: 'Contact Info',
    icon: Phone,
    fields: [
      { key: 'phone', label: 'Phone Number', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'website', label: 'Website', type: 'text' },
    ]
  },
  {
    id: 'value',
    title: 'What Makes Us Different',
    icon: Star,
    fields: [
      { key: 'unique_value', label: 'Unique Value Proposition', type: 'textarea', placeholder: 'What makes ASAP different from other credit repair companies?' },
      { key: 'process_summary', label: 'Our Process (Summary)', type: 'textarea', placeholder: 'Brief overview of how your credit repair process works' },
    ]
  },
  {
    id: 'stats',
    title: 'Company Stats',
    icon: Users,
    fields: [
      { key: 'clients_helped', label: 'Clients Helped', type: 'text', placeholder: 'e.g., 67,000+' },
      { key: 'reviews_count', label: 'Reviews/Rating', type: 'text', placeholder: 'e.g., 3,000+ five-star reviews' },
      { key: 'years_in_business', label: 'Years in Business', type: 'text' },
    ]
  },
  {
    id: 'pricing',
    title: 'Pricing Overview',
    icon: DollarSign,
    fields: [
      { key: 'pricing_summary', label: 'Pricing Summary', type: 'textarea', placeholder: 'General pricing info (the AI will use this to answer pricing questions)' },
    ]
  },
  {
    id: 'team',
    title: 'Team Overview',
    icon: Users,
    fields: [
      { key: 'team_summary', label: 'Team Summary', type: 'textarea', placeholder: 'Key team members, roles, who does what' },
    ]
  },
  {
    id: 'compliance',
    title: 'Compliance Notes',
    icon: FileText,
    fields: [
      { key: 'compliance_notes', label: 'What We Can/Cannot Promise', type: 'textarea', placeholder: 'Important compliance info - what consultants should never say, guarantees we can\'t make, etc.' },
    ]
  },
  {
    id: 'additional',
    title: 'Additional Context',
    icon: Sparkles,
    fields: [
      { key: 'additional_context', label: 'Anything Else the AI Should Know', type: 'textarea', placeholder: 'Any other important context about the company, culture, approach, etc.' },
    ]
  },
];

export default function CompanyProfile() {
  const { currentUser } = useApp();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedSection, setExpandedSection] = useState('basic');

  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/company_profile?select=*&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]) {
          setProfile({ ...DEFAULT_PROFILE, ...data[0] });
        }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setSaved(false);
    
    try {
      // Check if profile exists
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/company_profile?select=id&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      const existing = await checkRes.json();
      
      const profileData = { ...profile, updated_at: new Date().toISOString() };
      delete profileData.id;
      delete profileData.created_at;
      
      if (existing?.[0]?.id) {
        // Update
        await fetch(
          `${SUPABASE_URL}/rest/v1/company_profile?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(profileData)
          }
        );
      } else {
        // Insert
        await fetch(
          `${SUPABASE_URL}/rest/v1/company_profile`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(profileData)
          }
        );
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          This page is only available to administrators.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Building className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Company Profile</h1>
              <p className="text-slate-500 text-sm">This info is always available to the AI — like ChatGPT's memory</p>
            </div>
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all ${
              saved 
                ? 'bg-green-600 text-white' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            } disabled:opacity-50`}
          >
            {saving ? <Loader size={18} className="animate-spin" /> : saved ? <Check size={18} /> : <Save size={18} />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
          <p className="text-indigo-800 text-sm">
            <strong>How this works:</strong> Everything you enter here is automatically included in every AI response. 
            The AI will always know this information about ASAP Credit Repair — it's like building the AI's permanent memory about your company.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {SECTIONS.map(section => {
            const Icon = section.icon;
            const isExpanded = expandedSection === section.id;
            
            return (
              <div key={section.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Icon size={20} className="text-slate-600" />
                    </div>
                    <span className="font-semibold text-slate-800">{section.title}</span>
                  </div>
                  <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4">
                    {section.fields.map(field => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {field.label}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea
                            value={profile[field.key] || ''}
                            onChange={(e) => updateField(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            rows={4}
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        ) : (
                          <input
                            type="text"
                            value={profile[field.key] || ''}
                            onChange={(e) => updateField(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
