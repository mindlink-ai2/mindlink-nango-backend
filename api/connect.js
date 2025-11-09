// api/connect.js
// Redirige automatiquement vers le flow OAuth Nango pour le provider indiqué.
//
// Usage :
//   /api/connect?provider=hubspot&endUserId=u123
//   /api/connect?provider=google-mail&endUserId=u123
//   /api/connect?provider=linkedin&endUserId=u123
//
// Si tu veux le picker Nango : /api/connect?endUserId=u123  (sans provider)

export default async function handler(req, res) {
  // CORS (au cas où tu l'appelles en XHR)
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
    const host      = process.env.NANGO_HOST || 'https://api.nango.dev';

    const payload = { end_user: { id: endUserId } };
    if (provider) {
      payload.allowed_integrations = [provider];
    }

    const resp = await fetch(`${host}/connect/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({}));
    const token =
      data?.token ||
      data?.nango?.data?.token ||
      data?.data?.token ||
      null;

    if (!token) {
      // Affiche l’erreur lisible dans le navigateur
      return res
        .status(502)
        .send(
          `<pre style="font-family:system-ui,monospace">NANGO ERROR\n\n${JSON.stringify(data, null, 2)}</pre>`
        );
    }

    const connectLink =
      data?.connect_link ||
      `https://connect.nango.dev/?session_token=${token}`;

    // 🔁 Redirection 302 vers Nango Connect
    res.writeHead(302, { Location: connectLink });
    return res.end();

  } catch (e) {
    return res
      .status(500)
      .send(`<pre>SESSION_TOKEN_ERROR: ${e?.message || e}</pre>`);
  }
}
