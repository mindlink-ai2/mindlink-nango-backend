// api/connect.js
// Redirige automatiquement vers le flow OAuth Nango pour le provider indiqué.
//
// Usage :
//   /api/connect?provider=hubspot&endUserId=u123
//   /api/connect?provider=google-mail-gzeg&endUserId=u123   <-- ⚠️ TON provider
//   /api/connect?provider=linkedin&endUserId=u123
//   /api/connect?endUserId=u123           (ouvre le picker Nango si pas de provider)

export default async function handler(req, res) {
  // CORS (si appelé en XHR)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: 'MISSING_ENV_NANGO_SECRET_KEY' });

    const endUserId = String(req.query.endUserId || 'ML000001');
    const host      = process.env.NANGO_HOST || 'https://api.nango.dev';

    // ---- Provider (on force ton provider custom si "google-mail" est passé par erreur)
    const rawProvider = (req.query.provider || '').toString().trim();

    // Map d’alias => évite d’appeler par erreur l’app Google de Nango
    const providerAliasMap = {
      'google-mail': process.env.NANGO_GOOGLE_PROVIDER || 'google-mail-gzeg',
      'gmail':       process.env.NANGO_GOOGLE_PROVIDER || 'google-mail-gzeg',
    };
    const provider = providerAliasMap[rawProvider] || rawProvider;

    // Payload pour la session Nango
    const payload = { end_user: { id: endUserId } };
    // Si provider fourni => on restreint à CETTE intégration (sinon picker)
    if (provider) payload.allowed_integrations = [provider];

    const resp = await fetch(`${host}/connect/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });

    // Gestion d’erreurs lisibles
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res
        .status(resp.status)
        .send(`<pre style="font-family:system-ui,monospace">NANGO ERROR\n\n${JSON.stringify(data, null, 2)}</pre>`);
    }

    const token = data?.token || data?.data?.token;
    if (!token) {
      return res
        .status(502)
        .send(`<pre style="font-family:system-ui,monospace">NANGO ERROR\n\n${JSON.stringify(data, null, 2)}</pre>`);
    }

    // URL de connexion (préférence pour app.nango.dev; fallback si Nango renvoie un lien direct)
    const connectLink =
      data?.connect_link || `https://app.nango.dev/connect?session_token=${encodeURIComponent(token)}`;

    // Redirection 302 vers la Connect UI (qui enchaîne vers Google OAuth)
    res.writeHead(302, { Location: connectLink });
    return res.end();
  } catch (e) {
    return res
      .status(500)
      .send(`<pre style="font-family:system-ui,monospace">SESSION_TOKEN_ERROR: ${e?.message || e}</pre>`);
  }
}
