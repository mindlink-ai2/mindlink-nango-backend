// pages/api/connect.js
// GET /api/connect?endUserId=CLIENT_ID
// GET /api/connect?provider=hubspot-ml&endUserId=CLIENT_ID
// GET /api/connect?provider=google-mail-gzeg&endUserId=CLIENT_ID&returnUrl=https://mind-link.fr/connected
// GET /api/connect?debug=1&...  -> ne redirige pas, renvoie l'URL construite (pour tester)

export default async function handler(req, res) {
  // CORS basique
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).send('Missing env NANGO_SECRET_KEY');

    // IMPORTANT : utilise toujours l’API, pas l’app
    const host = process.env.NANGO_HOST || 'https://api.nango.dev';

    // ⚠️ Mets le provider Gmail par défaut si tu veux que /api/connect?endUserId=... ouvre Gmail
    const DEFAULT_PROVIDER = process.env.NANGO_DEFAULT_PROVIDER || 'google-mail-gzeg';

    const provider  = (req.query.provider || DEFAULT_PROVIDER).toString().trim();
    const endUserId = (req.query.endUserId || '').toString().trim();
    const returnUrl = (req.query.returnUrl || '').toString().trim();
    const debug     = req.query.debug === '1';

    if (!endUserId) {
      return res.status(400).send('Missing endUserId (ex: /api/connect?endUserId=client_123)');
    }

    // 1) Upsert l’utilisateur (idempotent)
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` };
    const createUserResp = await fetch(`${host}/v1/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: endUserId })
    });

    if (!createUserResp.ok) {
      const txt = await createUserResp.text();
      return res.status(502).send(`Nango /v1/users failed: ${txt}`);
    }

    // 2) Construire l’URL d’OAuth DIRECTE (pas de picker)
    const url = new URL(`${host}/oauth/connect`);
    url.searchParams.set('provider_config_key', provider);              // ex: google-mail-gzeg | hubspot-ml
    url.searchParams.set('end_user', endUserId);                        // DOIT exister chez Nango
    url.searchParams.set('connection_id', `${provider}-${endUserId}`);  // pratique pour retrouver la connexion
    if (returnUrl) url.searchParams.set('return_url', returnUrl);

    if (debug) {
      // mode test : ne redirige pas, montre ce qui va être appelé
      return res.status(200).json({
        providerUsed: provider,
        endUserId,
        oauthUrl: url.toString()
      });
    }

    // 3) Redirection 302 vers le consent screen du provider
    res.writeHead(302, { Location: url.toString() });
    return res.end();

  } catch (e) {
    console.error('CONNECT_ERROR:', e);
    return res.status(500).send(`CONNECT_ERROR: ${e?.message || e}`);
  }
}
