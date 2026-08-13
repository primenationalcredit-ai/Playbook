import re
s = open('src/pages/LeadershipProjects.jsx', encoding='utf-8', errors='surrogateescape').read()
lines = s.split('\n')
print("=== imports (top 30) ===")
for i in range(0, 30): print(f"{i+1:5d}  {lines[i]}")
print()
print("=== card click / modal open / save handlers ===")
hits = [i for i, l in enumerate(lines) if re.search(r'setShowCardModal|setEditingCard|handleSaveCard|onSave=|onClick=.*[Cc]ard|apiCall\(', l)]
shown = set()
for h in hits:
    for i in range(max(0, h-2), min(len(lines), h+3)):
        if i not in shown:
            shown.add(i)
            print(f"{i+1:5d}  {lines[i]}")
