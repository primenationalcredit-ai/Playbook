import sys
f = 'netlify.toml'
s = open(f, encoding='utf-8').read()
# show what's actually around payment-enrich
i = s.find('payment-enrich')
print("CONTEXT:", repr(s[max(0,i-80):i+140]))

changed = 0
old1 = '"* 12-23 * * *"'
if s.count(old1) == 1:
    s = s.replace(old1, '"* 8-23 * * *"', 1); changed += 1
else:
    print(f"sync anchor x{s.count(old1)}")
old2 = '"*/5 13-23 * * 1-6"'
n2 = s.count(old2)
if n2 >= 1:
    s = s.replace(old2, '"*/5 8-23 * * 1-6"', n2); changed += n2
    print(f"enrich-style schedules updated: {n2}")
else:
    print("enrich anchor x0 - see CONTEXT above")
if changed == 0: print("NOTHING CHANGED - aborting"); sys.exit(1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print(f"OK: {changed} schedule(s) moved to 2am MT start")
