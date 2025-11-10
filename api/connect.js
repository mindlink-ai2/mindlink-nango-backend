// pages/api/connect.js
// GET /api/connect?endUserId=CLIENT_ID
// GET /api/connect?provider=hubspot-ml&endUserId=CLIENT_ID
// GET /api/connect?provider=google-mail-gzeg&endUserId=CLIENT_ID&returnUrl=https://mind-link.fr/connected
// GET /api/connect?debug=1&... -> ne redirige pas, renvoie l’URL construite

export default async function handler(req, res) {
  // CORS basique
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    const publicKey = process.env.NANGO_PUBLIC_KEY;
    if (!secret) return res.status(500).send('Missing env NANGO_SECRET_KEY');
    if (!publicKey) return res.status(500).send('Missing env NANGO_PUBLIC_KEY');

    // API vs App hosts
    const apiHost = process.env.NANGO_API_HOST || 'https://api.nango.dev';
    const appHost = process.env.NANGO_APP_HOST || 'https://app.nango.dev';

    // Provider par défaut si non fourni
    const DEFAULT_PROVIDER = process.env.NANGO_DEFAULT_PROVIDER || 'google-mail-gzeg';

    const provider  = (req.query.provider || DEFAULT_PROVIDER).toString().trim();
    const endUserId = (req.query.endUserId || '').toString().trim();
    const returnUrl = (req.query.returnUrl || '').toString().trim();
    const debug     = req.query.debug === '1';

    if (!endUserId) {
      return res.status(400).send('Missing endUserId (ex: /api/connect?endUserId=client_123)');
    }

    // 1) Upsert user chez Nango (idempotent)
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` };
    const createUserResp = await fetch(`${apiHost}/v1/users`, {
      method: 'POST',
      headers,
      // ⬇️ clé correcte : internal_id
      body: JSON.stringify({
        internal_id: endUserId,
        metadata: { source: 'mindlink' }
      })
    });

    if (!createUserResp.ok) {
      const txt = await createUserResp.text();
      return res.status(502).send(`Nango /v1/users failed: ${txt}`);
    }

    // 2) URL Hosted Connect (front de Nango)
    // - avec provider => écran d’auth direct
    // - sans provider => picker d’intégrations
    const base = provider
      ? `${appHost}/oauth/connect`
      : `${appHost}/oauth/choose-integration`;

    const url = new URL(base);
    url.searchParams.set('public_key', publicKey);
    url.searchParams.set('end_user', endUserId);
    if (provider) url.searchParams.set('provider_config_key', provider);
    if (returnUrl) url.searchParams.set('return_url', returnUrl);

    if (debug) {
      return res.status(200).json({
        providerUsed: provider,
        endUserId,
        oauthUrl: url.toString()
      });
    }

    // 3) Redirection 302 vers l’écran de consentement
    res.writeHead(302, { Location: url.toString() });
    return res.end();

  } catch (e) {
    console.error('CONNECT_ERROR:', e);
    return res.status(500).send(`CONNECT_ERROR: ${e?.message || e}`);
  }
}
