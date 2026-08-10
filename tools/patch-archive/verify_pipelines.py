import sys
ok = True
s = open('src/pages/Pipelines.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["crm-pipeline-verify", "toggleStage", "exactly matches Pipedrive", "export default Pipelines"]:
    if needle not in s: ok = False; print(f"Pipelines MISSING: {needle}")
w = open('netlify/functions/crm-pipeline-verify.js', encoding='utf-8', errors='surrogateescape').read()
for needle in ["rpc/crm_pipeline_counts", "deals/summary?status=open", "our_total"]:
    if needle not in w: ok = False; print(f"verify fn MISSING: {needle}")
a = open('src/App.jsx', encoding='utf-8', errors='surrogateescape').read()
if a.count('path="pipelines"') != 1 or a.count("import Pipelines") != 1: ok = False; print("App.jsx wiring wrong")
l = open('src/components/Layout.jsx', encoding='utf-8', errors='surrogateescape').read()
if l.count("path: '/pipelines'") < 1: ok = False; print("Layout nav missing")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
