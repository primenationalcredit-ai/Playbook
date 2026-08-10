import sys
f = 'netlify/functions/consultant-bonus-sync.js'
s = open(f, encoding='utf-8').read()

old = """    let deals = [];
    let hasMore = false;

    if (mode === 'recent') {
      // Daily sync: only recently updated deals (last 24 hours)
      const data = await pdFetch(`/deals?sort=update_time DESC&start=${startOffset}&limit=${batchSize}`);
      deals = data.data || [];
      hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
      // Stop if we hit deals older than 48 hours
      const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const oldIdx = deals.findIndex(d => d.update_time < cutoff);
      if (oldIdx >= 0) { deals = deals.slice(0, oldIdx); hasMore = false; }
    } else {
      // Filter mode: use Pipedrive filter for Doc(1) = Yes
      const filterId = parseInt(params.filter) || DOC_FEE_FILTER;
      const data = await pdFetch(`/deals?filter_id=${filterId}&start=${startOffset}&limit=${batchSize}`);
      deals = data.data || [];
      hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
    }"""
new = """    let deals = [];
    let hasMore = false;

    // PERMANENT FIX (Cindy qualified-doc ticket 7/28): the scheduler only ever ran
    // page 1 and nothing followed nextUrl, so deals past the first 400 were never
    // judged - qualified docs stayed stale until someone paged by hand. Each run
    // now walks ALL pages itself (capped; nextUrl remains for manual continuation).
    const maxPages = parseInt(params.pages) || 12;
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    let cursor = startOffset;
    for (let pg = 0; pg < maxPages; pg++) {
      let pageDeals = [];
      if (mode === 'recent') {
        const data = await pdFetch(`/deals?sort=update_time DESC&start=${cursor}&limit=${batchSize}`);
        pageDeals = data.data || [];
        hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
        const oldIdx = pageDeals.findIndex(d => d.update_time < cutoff);
        if (oldIdx >= 0) { pageDeals = pageDeals.slice(0, oldIdx); hasMore = false; }
      } else {
        const filterId = parseInt(params.filter) || DOC_FEE_FILTER;
        const data = await pdFetch(`/deals?filter_id=${filterId}&start=${cursor}&limit=${batchSize}`);
        pageDeals = data.data || [];
        hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
      }
      deals.push(...pageDeals);
      cursor += batchSize;
      if (!hasMore) break;
    }"""
if s.count(old) != 1:
    print(f"ABORTED: fetch block anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old2 = "        nextUrl: hasMore ? `/.netlify/functions/consultant-bonus-sync?mode=${mode}&month=${targetMonth}&start=${startOffset + batchSize}` : null,"
new2 = "        nextUrl: hasMore ? `/.netlify/functions/consultant-bonus-sync?mode=${mode}&month=${targetMonth}&start=${cursor}` : null,"
if s.count(old2) != 1:
    print(f"ABORTED: nextUrl anchor x{s.count(old2)}"); sys.exit(1)
s = s.replace(old2, new2, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("BONUS SYNC NOW WALKS ITS OWN PAGES")
