module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', 'sc_dash=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  res.end(JSON.stringify({ ok: true }));
};
