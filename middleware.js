const COOKIE_NAME = 'sc_dash';

export const config = {
  matcher: ['/dashboard/:path*'],
};

function base64urlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function textBytes(value) {
  return new TextEncoder().encode(value);
}

async function hmac(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    textBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, textBytes(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseCookie(header) {
  return Object.fromEntries(
    String(header || '')
      .split(';')
      .map((part) => part.trim().split('='))
      .filter((pair) => pair.length === 2)
  );
}

function redirectToLogin(req) {
  const url = new URL('/login', req.url);
  url.searchParams.set('next', new URL(req.url).pathname);
  return Response.redirect(url, 307);
}

export default async function middleware(req) {
  const secret = process.env.SIGNALCARE_AUTH_SECRET;
  if (!secret) return redirectToLogin(req);

  const token = parseCookie(req.headers.get('cookie'))[COOKIE_NAME];
  if (!token || !token.includes('.')) return redirectToLogin(req);

  const [payload, sig] = token.split('.');
  const expected = await hmac(payload, secret);
  if (sig !== expected) return redirectToLogin(req);

  try {
    const data = JSON.parse(new TextDecoder().decode(base64urlToBytes(payload)));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return redirectToLogin(req);
  } catch (error) {
    return redirectToLogin(req);
  }

  return undefined;
}
