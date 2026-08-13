import sys

# 1) ai-sop.js writes name:, but the renderer reads l.label - write both
f1 = 'netlify/functions/ai-sop.js'
s1 = open(f1, encoding='utf-8', errors='surrogateescape').read()
a1 = "links.push({ name: `SOP v${version}`, url: '', sop: true,"
if s1.count(a1) != 1: print("ABORTED ai-sop anchor x" + str(s1.count(a1))); sys.exit(1)
b1 = "links.push({ label: `SOP v${version}`, name: `SOP v${version}`, url: '', sop: true,"
s1 = s1.replace(a1, b1, 1)
open(f1, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s1)
print("ai-sop.js: label field added")

# 2) SOP entries have no URL - render them as an expandable viewer, not an anchor
f2 = 'src/pages/LeadershipProjects.jsx'
s2 = open(f2, encoding='utf-8', errors='surrogateescape').read()
if "l.sop ?" in s2: print("ABORTED: renderer already patched"); sys.exit(1)
a2 = '<a href={l.url} target="_blank" rel="noreferrer" className="flex-1 text-asap-blue hover:underline truncate">{l.label}</a>'
if s2.count(a2) != 1: print("ABORTED renderer anchor x" + str(s2.count(a2))); sys.exit(1)
b2 = """{l.sop ? (
                    <details className="flex-1 min-w-0">
                      <summary className="cursor-pointer text-asap-blue hover:underline truncate list-none">{l.label || l.name}{l.approved_by ? ' - approved by ' + l.approved_by : ''}</summary>
                      <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">{l.content}</pre>
                    </details>
                  ) : (
                    <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 text-asap-blue hover:underline truncate">{l.label}</a>
                  )}"""
s2 = s2.replace(a2, b2, 1)
open(f2, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s2)
print("renderer patched: SOP entries expand in place, normal links unchanged")
