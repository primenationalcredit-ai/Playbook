import sys
f = 'src/pages/RefundTracking.jsx'
s = open(f, encoding='utf-8').read()
old = """                  <p className="text-xs text-gray-500 mt-0.5">
                    By {r.requested_by_name || r.requested_by || 'unknown'}: {r.reason}
                    {r.rounds_started ? ' (rounds started - release required)' : ''}
                  </p>"""
new = """                  <p className="text-xs text-gray-500 mt-0.5">
                    Requested by <span className="font-semibold text-gray-700">{r.requested_by_name || (r.requested_by || 'unknown').split('@')[0]}</span>
                    {' \\u00b7 '}Approved by <span className="font-semibold text-gray-700">{r.decided_by ? String(r.decided_by).split('@')[0] : (r.status === 'pending' ? 'awaiting approval' : 'unknown')}</span>
                    {' \\u00b7 '}Consultant: <span className="font-semibold text-gray-700">{r.consultant_name || 'unknown'}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Reason: {r.reason}
                    {r.rounds_started ? ' (rounds started - release required)' : ''}
                  </p>"""
cnt = s.count(old)
if cnt not in (1, 2): print(f"ABORTED: card anchor x{cnt}"); sys.exit(1)
s = s.replace(old, new)
open(f, 'w', encoding='utf-8', newline='').write(s)
print(f"refund cards now show requester, approver, and consultant ({cnt} card layout(s) updated)")
