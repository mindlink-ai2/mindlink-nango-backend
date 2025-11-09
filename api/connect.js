// api/connect.js
// Redirige vers le flow OAuth Nango pour le provider indiqué.
// - /api/connect?provider=hubspot&endUserId=u123
// - /api/connect?provider=linkedin&endUserId=u123
// - /api/connect?provider=google-mail-gzeg&endUserId=u123   ← ton provider custom
// - /api/connect?endUserId=u123                              ← ouvre le picker Nango

export default async function handler(req, res) {
  // CORS basique
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: 'MISSING_ENV_NANGO_SECRET_KEY' });

    const host = process.env.NANGO_HOST || 'https://api.nango.dev';
    const endUserId = String(req.query.endUserId || 'ML000001');

    // Provider demandé (optionnel)
    const rawProvider = (req.query.provider || '').toString().trim();

    // ⚠️ Seul cas spécial : si quelqu’un met encore "google-mail" ou "gmail",
    // on remappe vers TON provider custom (sans toucher HubSpot/LinkedIn/etc.)
    const googleCustom = process.env.NANGO_GOOGLE_PROVIDER || 'google-mail-gzeg';
    const provider =
      rawProvider === 'google-mail' || rawProvider === 'gmail'
        ? googleCustom
        : rawProvider;

    // Corps de création de session
    const payload = { end_user: { id: endUserId } };
    if (provider) payload.allowed_integrations = [provider]; // sinon picker

    // Appel Nango Connect Session
    const resp = await fetch(`${host}/connect/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res
        .status(resp.status)
        .send(`<pre style="font-family:system-ui,monospace">NANGO ERROR\n\n${JSON.stringify(data, null, 2)}</pre>`);
    }

    const token =
      data?.token || data?.data?.token || data?.nango?.data?.token || null;

    // Nango renvoie parfois un lien direct
    const connectLink =
      data?.connect_link ||
      data?.connect_url ||
      (token ? `https://app.nango.dev/connect?session_token=${encodeURIComponent(token)}` : null);

    if (!connectLink) {
      return res
        .status(502)
        .send(`<pre style="font-family:system-ui,monospace">NANGO ERROR\n\n${JSON.stringify(data, null, 2)}</pre>`);
    }

    // Redirection 302 vers la Connect UI
    res.writeHead(302, { Location: connectLink });
    return res.end();
  } catch (e) {
    return res
      .status(500)
      .send(`<pre style="font-family:system-ui,monospace">SESSION_TOKEN_ERROR: ${e?.message || e}</pre>`);
  }
}
