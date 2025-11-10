// pages/api/connect.js
// Redirige vers l'OAuth du provider (HubSpot par défaut)
// Usage : /api/connect?endUserId=CLIENT_ID
// Optionnel : /api/connect?provider=hubspot-ml&returnUrl=https://mind-link.fr/connected

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  // CORS (si tu déclenches depuis Framer)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const secret = process.env.NANGO_SECRET_KEY;
  if (!secret) return res.status(500).send('Missing NANGO_SECRET_KEY env var');

  const host = process.env.NANGO_HOST || 'https://api.nango.dev';

  // ⚠️ Mets ici la clé EXACTE de ton provider HubSpot dans Nango
  const DEFAULT_PROVIDER = process.env.NANGO_DEFAULT_PROVIDER || 'hubspot-ml';

  const provider  = (req.query.provider || DEFAULT_PROVIDER).toString().trim();
  const endUserId = (req.query.endUserId || '').toString().trim();
  const returnUrl = (req.query.returnUrl || '').toString().trim();

  if (!endUserId) {
    return res.status(400).send('Missing endUserId (ex: /api/connect?endUserId=client_123)');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`
  };

  try {
    // 1) Crée/assure l’utilisateur côté Nango (idempotent)
    await fetch(`${host}/v1/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: endUserId })
    });

    // 2) Construit l’URL d’OAuth directe
    const url = new URL(`${host}/oauth/connect`);
    url.searchParams.set('provider_config_key', provider);          // ex: hubspot-ml
    url.searchParams.set('end_user', endUserId);                    // même ID que ci-dessus
    url.searchParams.set('connection_id', `${provider}-${endUserId}`);
    if (returnUrl) url.searchParams.set('return_url', returnUrl);

    // 3) Redirection 302 vers la page de connexion du provider
    res.writeHead(302, { Location: url.toString() });
    res.end();
  } catch (e) {
    console.error('CONNECT_ERROR:', e);
    res.status(502).send('Nango connect error');
  }
}
