module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    ok: true,
    service: 'signalcare-ai-site',
    email_to: process.env.SIGNALCARE_TO_EMAIL || 'contact@signalcare.ltd',
    email_cc: process.env.SIGNALCARE_CC_EMAIL || 'b.lee@signalcarecorp.com',
    email_provider_configured: Boolean(process.env.RESEND_API_KEY),
    dashboard_auth_configured: Boolean(process.env.SIGNALCARE_DASHBOARD_PASSWORD && process.env.SIGNALCARE_AUTH_SECRET),
    timestamp: new Date().toISOString(),
  }));
};
