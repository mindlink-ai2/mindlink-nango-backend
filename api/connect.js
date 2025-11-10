// pages/api/connect.js
// Exemples :
//   /api/connect?provider=google-mail-gzeg&endUserId=ML_123&returnUrl=https://mind-link.fr/connected
//   /api/connect?provider=hubspot-ml&endUserId=ML_abc
//   /api/connect?endUserId=ML_123           -> utilisera DEFAULT_PROVIDER si défini
//   /api/connect?debug=1&...                -> ne redirige pas, renvoie l’URL construite (pour tester)

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

    const DEFAULT_PROVIDER = process.env.NANGO_DEFAULT_PROVIDER || ''; // ex: 'google-mail-gzeg' ou 'hubspot-ml'

    const provider  = (req.query.provider || DEFAULT_PROVIDER).toString().trim();
    const endUserId = (req.query.endUserId || '').toString().trim();
    const returnUrl = (req.query.returnUrl || '').toString().trim();
    const name      = (req.query.name || '').toString().trim();
    const email     = (req.query.email || '').toString().trim();
    const debug     = req.query.debug === '1';

    if (!endUserId) return res.status(400).send('Missing endUserId (ex: /api/connect?endUserId=ML_123)');
    if (!provider)   return res.status(400).send('Missing provider (or set NANGO_DEFAULT_PROVIDER)');

    // 1) Upsert user chez Nango (idempotent)
    await fetch('https://api.nango.dev/v1/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`
      },
      body: JSON.stringify({
        internal_id: endUserId,
        display_name: name || undefined,
        email: email || undefined,
        metadata: { source: 'mindlink' }
      })
    });

    // 2) Construire l’URL de connexion via l’API (pas besoin de public key)
    //    -> redirige directement vers l’écran de consentement du provider
    const url = new URL('https://api.nango.dev/oauth/connect');
    url.searchParams.set('provider_config_key', provider);              // ex: google-mail-gzeg | hubspot-ml
    url.searchParams.set('end_user', endUserId);                        // DOIT exister (créé juste au-dessus)
    url.searchParams.set('connection_id', `${provider}-${endUserId}`);  // pratique pour retrouver la connexion
    if (returnUrl) url.searchParams.set('return_url', returnUrl);

    if (debug) {
      return res.status(200).json({
        providerUsed: provider,
        endUserId,
        oauthUrl: url.toString()
      });
    }

    // 3) Redirection 302 vers la page de consentement (Google/HubSpot)
    res.writeHead(302, { Location: url.toString() });
    return res.end();

  } catch (e) {
    console.error('CONNECT_ERROR:', e);
    return res.status(500).send(`CONNECT_ERROR: ${e?.message || e}`);
  }
}
