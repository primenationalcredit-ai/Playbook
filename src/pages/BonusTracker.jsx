import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import ConsultantBonus from './ConsultantBonus';
import AMBonus from './AMBonus';
import CSRBonus from './CSRBonus';
import CreditTeamBonus from './CreditTeamBonus';

// One tracker for every role. Admins/leadership see all tabs; everyone else sees only their own
// department's view, which each child component already locks to the current user.
const ROLE_TABS = [
  { key: 'consultants', label: 'Consultants', dept: 'credit_consultants', Comp: ConsultantBonus },
  { key: 'account_managers', label: 'Account Managers', dept: 'account_managers', Comp: AMBonus },
  { key: 'csrs', label: 'CSRs', dept: 'customer_support', Comp: CSRBonus },
  { key: 'credit_team', label: 'Credit Team', dept: 'credit_team', Comp: CreditTeamBonus },
];

export default function BonusTracker() {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  const visible = isAdmin ? ROLE_TABS : ROLE_TABS.filter((t) => t.dept === currentUser?.department);
  const [active, setActive] = useState(visible[0]?.key);

  if (visible.length === 0) {
    return <div className="p-6 text-center text-slate-500">No bonus data is available for your role.</div>;
  }

  // Non-admins with a single view: render it directly, no tab bar.
  if (visible.length === 1) {
    const Only = visible[0].Comp;
    return <Only />;
  }

  const current = visible.find((t) => t.key === active) || visible[0];
  const ActiveComp = current.Comp;

  return (
    <div>
      <div className="px-6 pt-4 flex gap-2 border-b border-slate-200 bg-slate-50">
        {visible.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              current.key === t.key
                ? 'bg-white border border-b-0 border-slate-200 text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ActiveComp />
    </div>
  );
}
