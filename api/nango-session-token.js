// api/nango-session-token.js

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: 'MISSING_ENV_NANGO_SECRET_KEY' });

    // Body safe parse
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const endUserId = String(body?.endUserId || 'ML000001');
    const email = body?.email;
    const displayName = body?.displayName;
    const tags = body?.tags || { project: 'mindlink' };

    // Host Nango (cloud par défaut)
    const host = process.env.NANGO_HOST || 'https://api.nango.dev';

    // Appel direct à l’API Nango
    const resp = await fetch(`${host}/connect/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Secret Key côté serveur uniquement
        'Authorization': `Bearer ${secret}`
      },
      body: JSON.stringify({
        end_user: {
          id: endUserId,
          email,
          display_name: displayName,
          tags
        }
        // allowed_integrations: ['hubspot'] // ajoute-le plus tard si tu veux filtrer
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      return res.status(500).json({ error: 'NANGO_API_ERROR', nango: errData });
    }

    const data = await resp.json(); // { token: '...' }
    const token = data?.token;
    if (!token) return res.status(500).json({ error: 'NANGO_NO_TOKEN', raw: data });

    return res.status(200).json({ sessionToken: token, endUserId });
  } catch (err) {
    return res.status(500).json({
      error: 'SESSION_TOKEN_ERROR',
      message: err?.message
    });
  }
}
