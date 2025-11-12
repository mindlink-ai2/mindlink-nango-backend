// /api/connect.js
// Redirige vers la page d’acceptation Nango (consent UI) pour l’intégration demandée.
// Usage :
//   /api/connect?provider=hubspot&endUserId=USER_123
//   /api/connect?provider=google-mail&endUserId=USER_123
//   /api/connect?config=google-mail-gzeg&endUserId=USER_123   (cibler une config précise)
//   /api/connect?endUserId=USER_123                           (ouvre le picker Nango si aucun provider/config)
//
// ENV requis :
//   - NANGO_SECRET_KEY   (clé secrète d’environnement Nango)
//   - NANGO_API_BASE     (optionnel, défaut: https://api.nango.dev)

export default async function handler(req, res) {
  // CORS + no-cache (utile si tu déclenches en XHR depuis Framer)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const NANGO_SECRET_KEY = process.env.NANGO_SECRET_KEY;
    if (!NANGO_SECRET_KEY) {
      return res.status(500).json({ error: 'Missing env NANGO_SECRET_KEY' });
    }
    const NANGO_API_BASE = process.env.NANGO_API_BASE || 'https://api.nango.dev';

    // ⚠️ Parse URL côté serveur (compatible Vercel/Node)
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Nettoyage agressif contre le bug "premier clic" (espaces, NBSP, retours)
    const sanitize = (v) => (v || '').replace(/\s+/g, '').toLowerCase().trim();

    // provider = slug d’intégration (ex: hubspot, google-mail, notion)
    const providerRaw = url.searchParams.get('provider');
    const provider = sanitize(providerRaw);

    // config = providerConfigKey précis (ex: google-mail-gzeg) — facultatif
    const configRaw = url.searchParams.get('config');
    const config = sanitize(configRaw);

    // endUserId (obligatoire)
    const endUserId = (url.searchParams.get('endUserId') || url.searchParams.get('end_user_id') || '').trim();
    if (!endUserId) {
      return res.status(400).json({ error: 'Missing endUserId' });
    }

    // Optionnels (email/nom pour UI Nango)
    const endUserEmail = (url.searchParams.get('email') || '').trim();
    const endUserName  = (url.searchParams.get('name') || '').trim();

    // Corps de la création de session
    const body = {
      end_user: {
        id: endUserId,
        ...(endUserEmail ? { email: endUserEmail } : {}),
        ...(endUserName ? { display_name: endUserName } : {}),
      },
      // Bonus: redirections explicites (tu peux changer les chemins)
      success_redirect_url: `${url.origin}/connect/success`,
      failure_redirect_url: `${url.origin}/connect/failure`,
    };

    // Priorité à une CONFIG précise si fournie
    if (config) {
      body.allowed_connection_configs = [config];
    } else if (provider) {
      // Sinon, on restreint par INTEGRATION (slug). Si provider vide/erroné → on n’envoie rien et le picker s’affiche.
      body.allowed_integrations = [provider];
    }

    // Appel Nango: POST /connect/sessions
    const resp = await fetch(`${NANGO_API_BASE}/connect/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NANGO_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const text = await resp.text().catch(() => '');
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* body non-JSON côté erreur */ }

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: 'NANGO_CONNECT_SESSION_FAILED',
        details: json || text || `HTTP ${resp.status}`
      });
    }

    // Compatibilité connect_link / connect_url (selon version Nango)
    const connectLink =
      json?.data?.connect_link ||
      json?.data?.connect_url ||
      json?.connect_link ||
      json?.connect_url;

    if (!connectLink) {
      return res.status(502).json({ error: 'MISSING_CONNECT_LINK_IN_RESPONSE', details: json || text });
    }

    // ✅ Redirection 302 vers la page de consentement Nango
    res.writeHead(302, { Location: connectLink });
    return res.end();

  } catch (err) {
    console.error('CONNECT_HANDLER_ERROR', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', details: String((err && err.message) || err) });
  }
}
