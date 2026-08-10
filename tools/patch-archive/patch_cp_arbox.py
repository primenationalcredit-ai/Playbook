import sys
f = 'src/pages/ConsultantPayments.jsx'
s = open(f, encoding='utf-8').read()

# --- MTD Breakdown: add the AR cell (grid 4 -> 5 columns) ---
old = """              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><span className="block text-blue-200">Docs</span><span className="font-bold">{mtdStats.docs}</span></div>
                <div><span className="block text-blue-200">Partials</span><span className="font-bold">{mtdStats.partials}</span></div>
                <div><span className="block text-blue-200">Finals</span><span className="font-bold">{mtdStats.finals}</span></div>
                <div><span className="block text-blue-200">Total</span><span className="font-bold">{mtdStats.docs + mtdStats.partials + mtdStats.finals}</span></div>
              </div>"""
new = """              <div className="grid grid-cols-5 gap-2 text-xs">
                <div><span className="block text-blue-200">Docs</span><span className="font-bold">{mtdStats.docs}</span></div>
                <div><span className="block text-blue-200">Partials</span><span className="font-bold">{mtdStats.partials}</span></div>
                <div><span className="block text-blue-200">Finals</span><span className="font-bold">{mtdStats.finals}</span></div>
                <div><span className="block text-blue-200">Add Rd</span><span className="font-bold">{mtdStats.rounds || 0}</span></div>
                <div><span className="block text-blue-200">Total</span><span className="font-bold">{mtdStats.docs + mtdStats.partials + mtdStats.finals + (mtdStats.rounds || 0)}</span></div>
              </div>"""
if s.count(old) != 1: print(f"ABORTED: MTD grid anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

# --- YTD box: add the AR cell (grid 3 -> 4 columns) ---
old = """              <div className="grid grid-cols-3 gap-1 text-xs text-slate-500">
                <div><span className="block">Docs</span><span className="font-bold text-slate-700">{ytdStats.docs}</span></div>
                <div><span className="block">Partials</span><span className="font-bold text-slate-700">{ytdStats.partials}</span></div>
                <div><span className="block">Finals</span><span className="font-bold text-slate-700">{ytdStats.finals}</span></div>
              </div>"""
new = """              <div className="grid grid-cols-4 gap-1 text-xs text-slate-500">
                <div><span className="block">Docs</span><span className="font-bold text-slate-700">{ytdStats.docs}</span></div>
                <div><span className="block">Partials</span><span className="font-bold text-slate-700">{ytdStats.partials}</span></div>
                <div><span className="block">Finals</span><span className="font-bold text-slate-700">{ytdStats.finals}</span></div>
                <div><span className="block">Add Rd</span><span className="font-bold text-slate-700">{ytdStats.rounds || 0}</span></div>
              </div>"""
if s.count(old) != 1: print(f"ABORTED: YTD grid anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("Add Rd cell added to MTD Breakdown + YTD Totals (data was already counted, now shown)")
