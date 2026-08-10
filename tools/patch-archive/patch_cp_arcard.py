import sys
f = 'src/pages/ConsultantPayments.jsx'
s = open(f, encoding='utf-8').read()

old = '          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">'
new = '          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">'
if s.count(old) != 1: print(f"ABORTED: grid anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Transactions</p>"""
new = """            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Add Rd Sales</p>
                  <p className="text-xl font-bold text-slate-800">{mtdStats.rounds || 0}</p>
                </div>
              </div>
              <p className="text-lg font-semibold text-blue-600">{formatCurrency(mtdStats.roundsAmount || 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Transactions</p>"""
if s.count(old) != 1: print(f"ABORTED: transactions card anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("Add Rd Sales card added (count + dollars) between Finals and Transactions")
