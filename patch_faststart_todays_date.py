import sys

def abort(msg):
    print("ABORTED: " + msg)
    sys.exit(1)

TODAYS_DATE_KEY = "7cd0b70520acc393591f6b4d569d7c4c80ae98cb"

# ===== File 1: final-credit-hook.js =====
f = "netlify/functions/final-credit-hook.js"
s = open(f, encoding="utf-8", errors="surrogateescape").read()
a1 = "  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4'\n};"
if s.count(a1) != 1: abort(f + " anchor1 x" + str(s.count(a1)))
s = s.replace(a1, "  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4',\n  TODAYS_DATE: '" + TODAYS_DATE_KEY + "'\n};", 1)
a2 = "if (kind === 'final') toWrite.push({ ...base, event_type: bizDaysSince(deal.add_time, now) <= 5 ? 'pif_fast_start' : 'pif' });"
if s.count(a2) != 1: abort(f + " anchor2 x" + str(s.count(a2)))
b2 = "if (kind === 'final') toWrite.push({ ...base, event_type: bizDaysSince(deal[F.TODAYS_DATE] || deal.add_time, now) <= 7 ? 'pif_fast_start' : 'pif' });"
s = s.replace(a2, b2, 1)
open(f, "w", encoding="utf-8", errors="surrogateescape", newline="").write(s)
print(f + " patched")

# ===== File 2: qualified-doc-watchdog.js =====
f = "netlify/functions/qualified-doc-watchdog.js"
s = open(f, encoding="utf-8", errors="surrogateescape").read()
a1 = "  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4'\n};"
if s.count(a1) != 1: abort(f + " anchor1 x" + str(s.count(a1)))
s = s.replace(a1, "  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4',\n  TODAYS_DATE: '" + TODAYS_DATE_KEY + "'\n};", 1)
a2 = "if (needsPif) toWrite.push({ ...base, event_type: bizDaysSince(deal.add_time, now) <= 5 ? 'pif_fast_start' : 'pif' });"
if s.count(a2) != 1: abort(f + " anchor2 x" + str(s.count(a2)))
b2 = "if (needsPif) toWrite.push({ ...base, event_type: bizDaysSince(deal[F.TODAYS_DATE] || deal.add_time, pay.payment_date || now) <= 7 ? 'pif_fast_start' : 'pif' });"
s = s.replace(a2, b2, 1)
open(f, "w", encoding="utf-8", errors="surrogateescape", newline="").write(s)
print(f + " patched")

# ===== File 3: watchdog-manual.js (identical structure to file 2) =====
f = "netlify/functions/watchdog-manual.js"
s = open(f, encoding="utf-8", errors="surrogateescape").read()
a1 = "  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4'\n};"
if s.count(a1) != 1: abort(f + " anchor1 x" + str(s.count(a1)))
s = s.replace(a1, "  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4',\n  TODAYS_DATE: '" + TODAYS_DATE_KEY + "'\n};", 1)
a2 = "if (needsPif) toWrite.push({ ...base, event_type: bizDaysSince(deal.add_time, now) <= 5 ? 'pif_fast_start' : 'pif' });"
if s.count(a2) != 1: abort(f + " anchor2 x" + str(s.count(a2)))
b2 = "if (needsPif) toWrite.push({ ...base, event_type: bizDaysSince(deal[F.TODAYS_DATE] || deal.add_time, pay.payment_date || now) <= 7 ? 'pif_fast_start' : 'pif' });"
s = s.replace(a2, b2, 1)
open(f, "w", encoding="utf-8", errors="surrogateescape", newline="").write(s)
print(f + " patched")

# ===== File 4: consultant-bonus-sync.js =====
f = "netlify/functions/consultant-bonus-sync.js"
s = open(f, encoding="utf-8", errors="surrogateescape").read()
a1 = "  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4'\n};"
if s.count(a1) != 1: abort(f + " anchor1 x" + str(s.count(a1)))
s = s.replace(a1, "  FINAL_1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4',\n  TODAYS_DATE: '" + TODAYS_DATE_KEY + "'\n};", 1)
a2 = """      if (isPifFast) console.log; // noop-safe anchor for search
""" if False else None
a2 = """        let isPifFast = false;
        if (deal.add_time) {
          const addDate = new Date(deal.add_time);
          let bizDays = 0, d = new Date(addDate);
          d.setDate(d.getDate() + 1); // day AFTER signup is business day 1 (matches the $25 math)
          while (d <= now && bizDays <= 6) {
            if (d.getDay() !== 0 && d.getDay() !== 6) bizDays++;
            d.setDate(d.getDate() + 1);
          }
          isPifFast = bizDays <= 5;
        }"""
if s.count(a2) != 1: abort(f + " anchor2 x" + str(s.count(a2)))
b2 = """        let isPifFast = false;
        const todaysDateVal = deal[FIELDS.TODAYS_DATE] || deal.add_time;
        if (todaysDateVal) {
          const addDate = new Date(todaysDateVal);
          let bizDays = 0, d = new Date(addDate);
          d.setDate(d.getDate() + 1); // day AFTER Todays Date (agreement sent) is business day 1
          while (d <= now && bizDays <= 8) {
            if (d.getDay() !== 0 && d.getDay() !== 6) bizDays++;
            d.setDate(d.getDate() + 1);
          }
          isPifFast = bizDays <= 7;
        }"""
s = s.replace(a2, b2, 1)
open(f, "w", encoding="utf-8", errors="surrogateescape", newline="").write(s)
print(f + " patched")

# ===== File 5: consultant-bonus-metrics.js =====
f = "netlify/functions/consultant-bonus-metrics.js"
s = open(f, encoding="utf-8", errors="surrogateescape").read()
a1 = """    async function getDealValue(dealId) {
      if (!dealId) return 0;
      if (dealId in dealValueCache) return dealValueCache[dealId];
      if (dealMeta[dealId]) { dealValueCache[dealId] = dealMeta[dealId].value || 0; return dealValueCache[dealId]; }
      let v = 0;
      try {
        const r = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals/${dealId}?api_token=${PIPEDRIVE_API_KEY}`);
        if (r.ok) { const j = await r.json(); v = parseFloat(j.data?.value) || 0; }
      } catch (e) {}
      dealValueCache[dealId] = v;
      return v;
    }"""
if s.count(a1) != 1: abort(f + " anchor1 x" + str(s.count(a1)))
b1 = a1 + """
    // Fast Start anchor date (Joe 8/18, Kevin Lewis ticket): the real rule is 7
    // business days from the "Todays Date" Pipedrive field (when the agreement
    // went out) to the qualifying payment - not from the doc fee payment date,
    // which is what this used to anchor on.
    const dealTodaysDateCache = {};
    async function getDealTodaysDate(dealId) {
      if (!dealId) return null;
      if (dealId in dealTodaysDateCache) return dealTodaysDateCache[dealId];
      let v = null;
      try {
        const r = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals/${dealId}?api_token=${PIPEDRIVE_API_KEY}`);
        if (r.ok) { const j = await r.json(); v = j.data?.['""" + TODAYS_DATE_KEY + """'] || j.data?.add_time || null; }
      } catch (e) {}
      dealTodaysDateCache[dealId] = v;
      return v;
    }"""
s = s.replace(a1, b1, 1)

a2 = """        // Count business days between doc fee and final
        const docDate = new Date(docPayment.payment_date);
        const finalDate = new Date(finalPayment.payment_date);
        let bizDays = 0;
        let d = new Date(docDate);
        d.setDate(d.getDate() + 1); // start counting from next day
        while (d <= finalDate) {
          if (d.getDay() !== 0 && d.getDay() !== 6) bizDays++;
          d.setDate(d.getDate() + 1);
        }
        const qualified = bizDays <= 5;"""
if s.count(a2) != 1: abort(f + " anchor2 x" + str(s.count(a2)))
b2 = """        // Count business days from the "Todays Date" field (agreement sent) to final
        const todaysDateVal = await getDealTodaysDate(client.dealId);
        const anchorDate = todaysDateVal ? new Date(todaysDateVal) : new Date(docPayment.payment_date);
        const finalDate = new Date(finalPayment.payment_date);
        let bizDays = 0;
        let d = new Date(anchorDate);
        d.setDate(d.getDate() + 1); // start counting from next day
        while (d <= finalDate) {
          if (d.getDay() !== 0 && d.getDay() !== 6) bizDays++;
          d.setDate(d.getDate() + 1);
        }
        const qualified = bizDays <= 7;"""
s = s.replace(a2, b2, 1)

a3 = "          reason: qualified ? null : `Paid in full on business day ${bizDays} (must be within 5 to qualify)`"
if s.count(a3) != 1: abort(f + " anchor3 x" + str(s.count(a3)))
b3 = "          reason: qualified ? null : `Paid in full on business day ${bizDays} (must be within 7 to qualify)`"
s = s.replace(a3, b3, 1)

open(f, "w", encoding="utf-8", errors="surrogateescape", newline="").write(s)
print(f + " patched")

print("ALL 5 FILES PATCHED SUCCESSFULLY")
