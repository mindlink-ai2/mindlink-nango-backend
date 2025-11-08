// api/nango-session-token.js
// Génère un session token Nango pour lancer l'OAuth depuis ton front (Framer)

export default async function handler(req, res) {
  // CORS (Framer > Vercel)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({ error: 'MISSING_ENV_NANGO_SECRET_KEY' });
    }

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const endUserId = String(body?.endUserId || 'ML000001');

    // provider facultatif :
    // - si présent → ouvre directement HubSpot / Gmail / LinkedIn
    // - si absent → Nango affichera son picker
    const provider = (body?.provider || '').toString().trim();

    const host = process.env.NANGO_HOST || 'https://api.nango.dev';

    const payload = { end_user: { id: endUserId } };
    if (provider) payload.allowed_integrations = [provider];

    const resp = await fetch(`${host}/connect/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));

    // Nango renvoie souvent { token, connect_link, expires_at }
    const token = data?.token;
    const connectLink =
      data?.connect_link ||
      (token ? `https://connect.nango.dev/?session_token=${token}` : null);

    // ✅ Si on a un token, on renvoie 200 (même si resp.ok est false)
    if (token) {
      return res.status(200).json({
        sessionToken: token,
        connectLink,
        endUserId,
        provider: provider || null,
      });
    }

    // ❌ Sinon on renvoie l'erreur brute pour debug
    return res.status(502).json({
      error: 'NANGO_API_ERROR',
      nango: data,
    });
  } catch (e) {
    return res.status(500).json({
      error: 'SESSION_TOKEN_ERROR',
      message: e?.message,
    });
  }
}
