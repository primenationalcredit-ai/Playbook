s = open('netlify/functions/payment-enrich.js', encoding='utf-8', errors='surrogateescape').read()
lines = s.split('\n')
for i in range(182, 252):
    print(f"{i+1:5d}  {lines[i]}")
