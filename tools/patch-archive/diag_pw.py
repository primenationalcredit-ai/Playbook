f = 'netlify/functions/payment-webhook.js'
s = open(f, encoding='utf-8').read()
i = s.find('Missing required fields')
print(repr(s[i-260:i+140]))
