// gbp-count-scan.js (v3) - scheduled kicker. The real scan lives in
// gbp-count-scan-background.js (15-min limit). This just fires it and exits.
exports.handler = async () => {
  const base = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
  fetch(base + '/.netlify/functions/gbp-count-scan-background').catch(() => {});
  await new Promise(r => setTimeout(r, 800));
  return { statusCode: 200, body: 'background scan kicked' };
};