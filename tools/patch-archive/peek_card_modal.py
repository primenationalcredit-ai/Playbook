s = open('src/pages/LeadershipProjects.jsx', encoding='utf-8', errors='surrogateescape').read()
lines = s.split('\n')
# CardModal formData block + the fields the modal renders
i0 = next(i for i, l in enumerate(lines) if 'function CardModal' in l)
for i in range(i0, min(len(lines), i0 + 70)):
    print(f"{i+1:5d}  {lines[i]}")
