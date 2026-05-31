// api/auth-callback.js
// Google redirects here after sign-in. We exchange the code server-side
// (so the client secret never touches the browser), create a Supabase
// session, then pass it back to the frontend via the URL hash.

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SUPA_URL = 'https://qbgnjxrmimrtaqppctpe.supabase.co';
const SUPA_KEY = 'sb_publishable_FPmLBYzJTyI36Ql3mFCxtg_Y5TX-Ld0';

export default async function handler(req, res) {
  const { code, error } = req.query || {};

  if (error || !code) {
    return res.redirect('/?auth_error=access_denied');
  }

  // Must exactly match what was used to start the OAuth flow
  const proto      = req.headers['x-forwarded-proto'] || 'https';
  const host       = req.headers['x-forwarded-host']  || req.headers['host'];
  const redirectUri = `${proto}://${host}/api/auth-callback`;

  // ── Exchange code with Google ──
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    console.error('Google token exchange failed:', await tokenRes.text());
    return res.redirect('/?auth_error=token_failed');
  }

  const { id_token } = await tokenRes.json();

  // ── Create Supabase session from Google ID token ──
  const supaRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=id_token`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'google', id_token }),
  });

  if (!supaRes.ok) {
    console.error('Supabase id_token sign-in failed:', await supaRes.text());
    return res.redirect('/?auth_error=supabase_failed');
  }

  const data = await supaRes.json();

  // ── Pass session to frontend via URL hash ──
  // Hash fragments are never sent to servers or stored in logs — safe for tokens.
  const params = new URLSearchParams({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_in:    data.expires_in,
    user_id:       data.user.id,
    email:         data.user.email         || '',
    full_name:     data.user.user_metadata?.full_name  || '',
    avatar_url:    data.user.user_metadata?.avatar_url || '',
  });

  return res.redirect(`/#${params.toString()}`);
}
