import React from 'react';
import { UserCheck, AlertTriangle, Users } from 'lucide-react';

/**
 * Banner component to show coverage status in MyPlaybook
 * Shows when user is covering for someone else or when their tasks are being covered
 */
export default function CoverageBanner({ 
  coveringFor = [], // Users this person is covering for
  coveredBy = null, // User covering for this person (if they're out)
  usersOut = [] // All users who are out today
}) {
  if (coveringFor.length === 0 && !coveredBy && usersOut.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {/* Banner when user is covering for others */}
      {coveringFor.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-800">You're Covering Today</h3>
              <p className="text-blue-700 text-sm mt-1">
                You're covering tasks for:{' '}
                <span className="font-medium">
                  {coveringFor.map(u => u.name).join(', ')}
                </span>
              </p>
              <p className="text-blue-600 text-xs mt-2">
                Their tasks will appear in your playbook with a coverage badge.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Banner when user's tasks are being covered */}
      {coveredBy && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-600 text-white flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-800">You're Marked as Out</h3>
              <p className="text-amber-700 text-sm mt-1">
                Your tasks are being covered by:{' '}
                <span className="font-medium">{coveredBy.name}</span>
              </p>
              <p className="text-amber-600 text-xs mt-2">
                If this is incorrect, please contact your manager or check your PTO status.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Small info banner showing who's out today */}
      {usersOut.length > 0 && coveringFor.length === 0 && !coveredBy && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Users className="w-4 h-4" />
            <span>
              <span className="font-medium">{usersOut.length}</span> team member{usersOut.length !== 1 ? 's' : ''} out today
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Small badge to show on individual tasks that are coverage tasks
 */
export function CoverageTaskBadge({ coveringForName }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
      <UserCheck className="w-3 h-3" />
      Covering for {coveringForName}
    </span>
  );
}

/**
 * Badge to show when a task has no backup configured
 */
export function NoCoverageBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
      <AlertTriangle className="w-3 h-3" />
      No backup assigned
    </span>
  );
}
