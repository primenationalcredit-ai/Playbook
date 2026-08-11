s = open('src/pages/ConsultantPayments.jsx', encoding='utf-8').read()
n = ['Zoho links', 'Zelle/external:', 'd.app?.zoho']
m = [x for x in n if x not in s]
print('VERDICT:', 'ALL GOOD - safe to push' if not m else f'DO NOT PUSH {m}')
