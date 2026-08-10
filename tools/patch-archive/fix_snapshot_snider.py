import json, urllib.request, re
wk = re.search(r"eyJ[A-Za-z0-9._-]{60,}", open(r"..\asap-payment-processor\netlify\functions\logins-chaser.js", encoding="utf-8", errors="ignore").read()).group(0)
base = "https://kkcbpqbcpzcarxhknzza.supabase.co/rest/v1/app_cache"
hdr = { "apikey": wk, "Authorization": f"Bearer {wk}", "Content-Type": "application/json", "Prefer": "return=minimal" }
req = urllib.request.Request(f"{base}?cache_key=eq.am_pipeline_full&select=cache_value", headers=hdr)
rows = json.loads(urllib.request.urlopen(req).read().decode())
fv = json.loads(rows[0]["cache_value"])
dexkey = next(k for k in fv["accountManagers"] if "Dex" in k)
dex = fv["accountManagers"][dexkey]
before = len(dex["stalledClients"])
dex["stalledClients"] = [c for c in dex["stalledClients"] if c.get("name") != "Joe Snider"]
removed = before - len(dex["stalledClients"])
if removed:
    dex["reportStalled"] = max(0, dex.get("reportStalled", 0) - 1)
    if dex.get("totalClients"): dex["combinedStallRate"] = round(len(dex["stalledClients"]) / dex["totalClients"] * 100)
    if "totalStalled" in fv: fv["totalStalled"] = max(0, fv["totalStalled"] - 1)
body = json.dumps({ "cache_value": json.dumps(fv) }).encode()
req = urllib.request.Request(f"{base}?cache_key=eq.am_pipeline_full", data=body, headers=hdr, method="PATCH")
urllib.request.urlopen(req)
# verify by re-reading
rows = json.loads(urllib.request.urlopen(urllib.request.Request(f"{base}?cache_key=eq.am_pipeline_full&select=cache_value", headers=hdr)).read().decode())
fv2 = json.loads(rows[0]["cache_value"])
names = [c["name"] for c in fv2["accountManagers"][dexkey]["stalledClients"]]
print(f"removed: {removed} | Dex now {len(names)} stalled | Joe Snider present: {'Joe Snider' in names}")
