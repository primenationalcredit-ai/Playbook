f = 'netlify.toml'
t = open(f, encoding='utf-8').read()
if 'payment-enrich-tick' in t:
    print("toml already scheduled")
else:
    if not t.endswith('\n'): t += '\n'
    t += '\n[functions."payment-enrich-tick"]\n  schedule = "0 * * * *"\n'
    open(f, 'w', encoding='utf-8', newline='').write(t)
    print("toml: hourly enricher schedule added")
