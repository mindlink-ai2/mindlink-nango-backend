// /api/connect.js
// Redirige vers la page d’acceptation Nango (consent UI) pour l’intégration demandée.
// Usage :
//   /api/connect?provider=hubspot&endUserId=USER_123
//   /api/connect?provider=google-mail&endUserId=USER_123
//   /api/connect?endUserId=USER_123            (ouvre le picker Nango si aucun provider)
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

    // ⚠️ On parse l’URL nous-mêmes pour être 100% compatibles (Vercel / Node)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const provider = (url.searchParams.get('provider') || '').trim();  // ex: 'hubspot' ou 'google-mail' ou ton providerConfigKey custom
    const endUserId = (url.searchParams.get('endUserId') || url.searchParams.get('end_user_id') || '').trim();

    // Optionnels (si tu veux personnaliser l’UI ou tes webhooks côté Nango)
    const endUserEmail = (url.searchParams.get('email') || '').trim();
    const endUserName  = (url.searchParams.get('name') || '').trim();

    if (!endUserId) {
      return res.status(400).json({ error: 'Missing endUserId' });
    }

    // Corps de la création de session
    const body = {
      end_user: {
        id: endUserId,
        ...(endUserEmail ? { email: endUserEmail } : {}),
        ...(endUserName ? { display_name: endUserName } : {}),
      }
    };

    // Si un provider est spécifié, on restreint la session à cette intégration → l’UI saute direct sur la bonne page
    // (sinon, Nango affiche le picker)
    if (provider) {
      body.allowed_integrations = [provider];
    }

    // Appel Nango: POST /connect/sessions → { data: { token, connect_link, expires_at } }
    const resp = await fetch(`${NANGO_API_BASE}/connect/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NANGO_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    // Gestion d’erreur Nango lisible
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return res.status(resp.status).json({
        error: 'NANGO_CONNECT_SESSION_FAILED',
        details: text || `HTTP ${resp.status}`
      });
    }

    const json = await resp.json();
    const connectLink = json?.data?.connect_link;

    if (!connectLink) {
      return res.status(502).json({ error: 'MISSING_CONNECT_LINK_IN_RESPONSE' });
    }

    // ✅ Redirection 302 vers la page d’acceptation/consentement Nango
    res.writeHead(302, { Location: connectLink });
    return res.end();
  } catch (err) {
    console.error('CONNECT_HANDLER_ERROR', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', details: String(err && err.message || err) });
  }
}
