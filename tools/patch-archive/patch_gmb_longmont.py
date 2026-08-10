import sys, re, subprocess
out = subprocess.run(['git', 'grep', '-rl', 'GMB_LOCATIONS = ', '--', 'src'], capture_output=True, text=True).stdout.strip().split('\n')
f = out[0] if out and out[0] else None
if not f: print('ABORTED: definition file not found - paste the grep line above'); sys.exit(1)
print('definition file:', f)
s = open(f, encoding='utf-8').read()
m = re.search(r'GMB_LOCATIONS = \[(.*?)\];', s, re.S)
if not m: print('ABORTED: array not found in', f); sys.exit(1)
body = m.group(1)
print('--- current list ---')
print(body.strip()[:1200])
entries = re.findall(r"\{\s*name:\s*'([^']*)',\s*city:\s*'([^']*)',\s*state:\s*'([^']*)'\s*\}", body)
if not entries: print('ABORTED: entry format differs - paste the list above'); sys.exit(1)
if any('longmont' in e[0].lower() or 'longmont' in e[1].lower() for e in entries):
    print('Longmont already present - nothing to do'); sys.exit(1)
last = re.findall(r"\{\s*name:\s*'[^']*',\s*city:\s*'[^']*',\s*state:\s*'[^']*'\s*\}", body)[-1]
new_entry = "{ name: 'Longmont', city: 'Longmont', state: 'CO' }"
s = s.replace(last, last + ",\n  " + new_entry, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print(f'ADDED: {new_entry}')
