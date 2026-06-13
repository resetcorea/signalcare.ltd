const crypto = require('crypto');

const COOKIE_NAME = 'sc_dash';
const DAY = 24 * 60 * 60;

function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function allowedEmails() {
  return (process.env.SIGNALCARE_ALLOWED_EMAILS || 'contact@signalcare.ltd,b.lee@signalcarecorp.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const password = process.env.SIGNALCARE_DASHBOARD_PASSWORD;
  const secret = process.env.SIGNALCARE_AUTH_SECRET;
  if (!password || !secret) {
    return json(res, 503, { ok: false, error: 'Dashboard auth is not configured' });
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (error) {
    return json(res, 400, { ok: false, error: 'Invalid JSON body' });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const submitted = String(body.password || '');
  if (!allowedEmails().includes(email) || submitted !== password) {
    return json(res, 401, { ok: false, error: 'Invalid internal account or password' });
  }

  const exp = Math.floor(Date.now() / 1000) + DAY;
  const payload = base64url(JSON.stringify({ email, exp }));
  const token = `${payload}.${sign(payload, secret)}`;
  const cookie = `${COOKIE_NAME}=${token}; Path=/; Max-Age=${DAY}; HttpOnly; Secure; SameSite=Lax`;
  return json(res, 200, { ok: true, email }, { 'Set-Cookie': cookie });
};
