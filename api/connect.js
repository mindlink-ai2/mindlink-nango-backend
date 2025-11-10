// pages/api/connect.js
export default async function handler(req, res) {
  // CORS + no-cache
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).send('Missing env NANGO_SECRET_KEY');

    // ⚠️ DOIT être le provider_config_key EXACT (ex: google-mail-gzeg, hubspot-ml)
    const provider = (req.query.provider || process.env.NANGO_DEFAULT_PROVIDER || '').toString().trim();
    if (!provider) return res.status(400).send('Missing provider (or set NANGO_DEFAULT_PROVIDER)');

    // Génère un endUserId unique (pas besoin de variable côté Framer)
    const endUserId = `ML_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    // returnUrl par défaut (ta page de succès)
    const returnUrl = req.query.returnUrl?.toString().trim() || 'https://mind-link.fr/connected';

    // 1) Upsert user (idempotent) — requis sinon Nango renvoie des écrans internes
    await fetch('https://api.nango.dev/v1/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`
      },
      body: JSON.stringify({
        internal_id: endUserId,
        metadata: { source: 'mindlink', auto: true }
      })
    });

    // 2) API connect → redirection consentement provider (PAS le dashboard Nango)
    const url = new URL('https://api.nango.dev/oauth/connect');
    url.searchParams.set('provider_config_key', provider);
    url.searchParams.set('end_user', endUserId);
    url.searchParams.set('connection_id', `${provider}-${endUserId}`);
    url.searchParams.set('return_url', returnUrl);

    // 3) Redirection (307 pour éviter les bizarreries de cache/navigation)
    res.writeHead(307, { Location: url.toString() });
    return res.end();

  } catch (err) {
    console.error('CONNECT_ERROR:', err);
    return res.status(500).send(`CONNECT_ERROR: ${err?.message || err}`);
  }
}
