const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_ALLOWED_ORIGINS = [
  'https://signalcare.ltd',
  'https://www.signalcare.ltd',
];

function json(req, res, status, body) {
  const configuredOrigins = (process.env.SIGNALCARE_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = configuredOrigins.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
  const origin = req.headers ? req.headers.origin : '';

  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(body));
}

function clean(value, max = 4000) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(req, res, 200, { ok: true });
  if (req.method !== 'POST') return json(req, res, 405, { ok: false, error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SIGNALCARE_TO_EMAIL || 'contact@signalcare.ltd';
  const cc = (process.env.SIGNALCARE_CC_EMAIL || 'b.lee@signalcarecorp.com')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
  const from = process.env.SIGNALCARE_FROM_EMAIL || 'SignalCare Website <contact@signalcare.ltd>';

  if (!apiKey) {
    return json(req, res, 200, { ok: false, fallback: 'mailto', error: 'RESEND_API_KEY is not configured' });
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (error) {
    return json(req, res, 400, { ok: false, error: 'Invalid JSON body' });
  }

  const lead = {
    name: clean(body.name, 120),
    company: clean(body.company, 160),
    email: clean(body.email, 180),
    country: clean(body.country, 120),
    type: clean(body.type, 120),
    message: clean(body.message, 5000),
  };

  if (!lead.name || !lead.email || !lead.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return json(req, res, 400, { ok: false, error: 'Name, valid email, and message are required' });
  }

  const subject = `[SignalCare] ${lead.type || 'Website inquiry'} - ${lead.company || lead.name}`;
  const text = [
    'New SignalCare website inquiry',
    '',
    `Name: ${lead.name}`,
    `Company: ${lead.company || '-'}`,
    `Email: ${lead.email}`,
    `Country: ${lead.country || '-'}`,
    `Request type: ${lead.type || '-'}`,
    '',
    lead.message,
  ].join('\n');

  const html = `
    <h2>New SignalCare website inquiry</h2>
    <p><strong>Name:</strong> ${escapeHtml(lead.name)}</p>
    <p><strong>Company:</strong> ${escapeHtml(lead.company || '-')}</p>
    <p><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
    <p><strong>Country:</strong> ${escapeHtml(lead.country || '-')}</p>
    <p><strong>Request type:</strong> ${escapeHtml(lead.type || '-')}</p>
    <hr>
    <p>${escapeHtml(lead.message).replace(/\n/g, '<br>')}</p>
  `;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        cc,
        reply_to: lead.email,
        subject,
        text,
        html,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(req, res, 502, { ok: false, error: payload.message || 'Email provider failed' });
    }
    return json(req, res, 200, { ok: true, id: payload.id || null });
  } catch (error) {
    return json(req, res, 502, { ok: false, error: 'Email provider request failed' });
  }
};
