// api/connect.js
import { Nango } from '@nangohq/node';

export default async function handler(req, res) {
  // CORS / méthodes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).send('<pre>MISSING_ENV_NANGO_SECRET_KEY</pre>');

    const host = process.env.NANGO_HOST || 'https://api.nango.dev';
    const endUserId = String(req.query.endUserId || 'ML000001');

    // Provider passé en query (on force ton provider custom si quelqu’un met "google-mail")
    const rawProvider = (req.query.provider || '').toString().trim();
    const forcedGoogle = process.env.NANGO_GOOGLE_PROVIDER || 'google-mail-gzeg';
    const provider =
      rawProvider === 'google-mail' || rawProvider === 'gmail'
        ? forcedGoogle
        : rawProvider;

    const nango = new Nango({ secretKey: secret, host });

    // Crée une session Connect
    const session = await nango.createConnectSession({
      end_user: { id: endUserId },
      ...(provider ? { allowed_integrations: [provider] } : {}) // sans provider => picker
    });

    const { connect_url, token } = session.data || {};

    // 1) Utilise le lien officiel si dispo
    if (connect_url) {
      return res.redirect(302, connect_url);
    }

    // 2) Sinon, retombe proprement sur app.nango.dev/connect
    if (token) {
      const url = `https://app.nango.dev/connect?session_token=${encodeURIComponent(token)}`;
      return res.redirect(302, url);
    }

    // 3) Debug lisible si rien
    return res
      .status(502)
      .send(`<pre style="font-family:system-ui,monospace">NANGO ERROR\n\n${JSON.stringify(session, null, 2)}</pre>`);
  } catch (e) {
    return res
      .status(500)
      .send(`<pre style="font-family:system-ui,monospace">SESSION_TOKEN_ERROR: ${e?.message || e}</pre>`);
  }
}
