// pages/api/connect.js
export default async function handler(req, res) {
  // CORS + no-cache
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const secret = process.env.NANGO_SECRET_KEY;
  if (!secret) return res.status(500).send('Missing env NANGO_SECRET_KEY');

  const provider  = (req.query.provider || process.env.NANGO_DEFAULT_PROVIDER || '').toString().trim();
  const debug     = req.query.debug === '1' || req.query.debug === 'diag' || req.query.debug === 'deep';
  const endUserId = `ML_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const returnUrl = req.query.returnUrl?.toString().trim() || 'https://mind-link.fr/connected';

  if (!provider) return res.status(400).send('Missing provider (or set NANGO_DEFAULT_PROVIDER)');

  try {
    // 0) Check integration exists in this environment
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` };
    const integResp = await fetch(`https://api.nango.dev/v1/integrations/${encodeURIComponent(provider)}`, { headers });
    const integTxt  = await integResp.text();

    // 1) Upsert user (idempotent)
    const upsertResp = await fetch('https://api.nango.dev/v1/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({ internal_id: endUserId })
    });
    const upsertTxt = await upsertResp.text();

    // 2) Build OAuth URL (API flow)
    const oauthUrl = new URL('https://api.nango.dev/oauth/connect');
    oauthUrl.searchParams.set('provider_config_key', provider);
    oauthUrl.searchParams.set('end_user', endUserId);
    oauthUrl.searchParams.set('connection_id', `${provider}-${endUserId}`);
    oauthUrl.searchParams.set('return_url', returnUrl);

    // 3) If debug, **don’t** redirect: expose diagnostics + the Location Nango would return
    if (debug) {
      // try preflight to read Location without following
      let locationHeader = null;
      try {
        const pre = await fetch(oauthUrl, { redirect: 'manual' });
        locationHeader = pre.headers.get('location');
      } catch (e) {
        // ignore
      }

      return res.status(200).json({
        provider_used: provider,
        env_secret_prefix: secret.slice(0, 6), // sk_dev_ / sk_live_ visible
        integration_check: { ok: integResp.ok, status: integResp.status, body: integTxt?.slice(0, 4000) },
        user_upsert: { ok: upsertResp.ok, status: upsertResp.status, body: upsertTxt?.slice(0, 1000) },
        oauth_connect_url: oauthUrl.toString(),
        nango_redirect_location: locationHeader, // <== si ça pointe vers app.nango.dev/dev/... on le voit ici
      });
    }

    // 4) Normal redirect (consent)
    res.writeHead(307, { Location: oauthUrl.toString() });
    return res.end();

  } catch (err) {
    console.error('CONNECT_ERROR:', err);
    return res.status(500).send(`CONNECT_ERROR: ${err?.message || err}`);
  }
}
