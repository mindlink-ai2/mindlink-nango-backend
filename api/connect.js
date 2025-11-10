// pages/api/connect.js
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).send('Missing env NANGO_SECRET_KEY');

    // ✅ Provider par défaut si rien n'est passé
    const provider = (req.query.provider || process.env.NANGO_DEFAULT_PROVIDER || '').toString().trim();
    if (!provider) return res.status(400).send('Missing provider');

    // ✅ On génère automatiquement un endUserId unique
    const endUserId = `ML_${Date.now()}_${Math.floor(Math.random() * 999999)}`;

    // ✅ return URL (par défaut page d'accueil de ton site)
    const returnUrl = encodeURIComponent(req.query.returnUrl || 'https://mind-link.fr/connected');

    // ✅ 1) On crée l'utilisateur dans Nango
    await fetch('https://api.nango.dev/v1/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`
      },
      body: JSON.stringify({
        internal_id: endUserId,
        metadata: { auto: true }
      })
    });

    // ✅ 2) URL OAuth → consentement direct
    const url = new URL('https://api.nango.dev/oauth/connect');
    url.searchParams.set('provider_config_key', provider);
    url.searchParams.set('end_user', endUserId);
    url.searchParams.set('connection_id', `${provider}-${endUserId}`);
    url.searchParams.set('return_url', returnUrl);

    // ✅ 3) Redirection vers consentement
    res.writeHead(302, { Location: url.toString() });
    return res.end();

  } catch (err) {
    console.error("CONNECT_ERROR:", err);
    return res.status(500).send(`CONNECT_ERROR: ${err.message}`);
  }
}
