// /api/connect.js
// Usage :
//   /api/connect?provider=hubspot-ml&endUserId=u123&returnUrl=https://mind-link.fr/connected
//   /api/connect?provider=google-mail-gzeg&endUserId=u123
//   /api/connect?endUserId=u123  (ouvre le picker Nango)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: 'MISSING_ENV_NANGO_SECRET_KEY' });

    const endUserId = String(req.query.endUserId || 'ML000001');
    const provider  = (req.query.provider || '').toString().trim(); // optionnel
    const returnUrl = (req.query.returnUrl || '').toString().trim(); // optionnel
    const host      = process.env.NANGO_HOST || 'https://api.nango.dev';

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`
    };

    // 1) Upsert l'utilisateur Nango (IMPORTANT pour éviter unknown_user_account)
    await fetch(`${host}/v1/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: endUserId,
        // Optionnel: passe email/name si tu les as (ex: depuis Framer plus tard)
        // email: req.query.email,
        // name: req.query.name,
      })
    });

    // 2a) Si provider est précisé → flow direct OAuth pour ce provider
    if (provider) {
      const url = new URL(`${host}/oauth/connect`);
      url.searchParams.set('provider_config_key', provider);      // ex: google-mail-gzeg | hubspot-ml
      url.searchParams.set('end_user', endUserId);                // doit matcher l'user créé ci-dessus
      url.searchParams.set('connection_id', `${provider}-${endUserId}`); // pratique pour retrouver la connexion
      if (returnUrl) url.searchParams.set('return_url', returnUrl);

      res.writeHead(302, { Location: url.toString() });
      return res.end();
    }

    // 2b) Sinon → créer une session pour le picker Nango (avec filtre optionnel)
    const payload = {
      end_user: { id: endUserId },
      // Si tu veux limiter les intégrations visibles dans le picker, dé-commente:
      // allowed_integrations: ['google-mail-gzeg', 'hubspot-ml']
    };

    const resp = await fetch(`${host}/connect/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({}));
    const token =
      data?.token ||
      data?.nango?.data?.token ||
      data?.data?.token ||
      null;

    if (!token) {
      return res
        .status(502)
        .send(`<pre style="font-family:system-ui,monospace">NANGO ERROR\n\n${JSON.stringify(data, null, 2)}</pre>`);
    }

    const connectLink = data?.connect_link || `https://connect.nango.dev/?session_token=${token}`;

    res.writeHead(302, { Location: connectLink });
    return res.end();

  } catch (e) {
    return res.status(500).send(`<pre>CONNECT_ERROR: ${e?.message || e}</pre>`);
  }
}
