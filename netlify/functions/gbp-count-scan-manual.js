// Manual door for the scheduled gbp-count-scan (Netlify blocks direct calls to scheduled functions).
const { handler } = require('./gbp-count-scan.js');
exports.handler = handler;
