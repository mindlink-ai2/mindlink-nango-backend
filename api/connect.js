// pages/api/connect.js
export default async function handler(req, res) {
  // CORS + no-cache
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const secret = process.env.NANGO_SECRET_KEY;
  if (!secret) return res.status(500).send('Missing env NANGO_SECRET_KEY');

  // params venant du bouton Framer
  const integrationId = (req.query.provider || '').toString().trim(); // ex: "google-mail-gzeg" ou "hubspot"
  const endUserId     = (req.query.endUserId || req.query.end_user || '').toString().trim(); // ex: "{user.id}"

  if (!integrationId) return res.status(400).send('Missing provider/integration_id');
  if (!endUserId)     return res.status(400).send('Missing endUserId');

  try {
    // IMPORTANT: endpoint v1 + schéma: { integration_id, end_user: { id } }
    const r = await fetch('https://api.nango.dev/v1/connect/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        integration_id: integrationId,
        end_user: { id: endUserId }
        // Optionnel:
        // success_url: 'https://mind-link.fr/connected',
        // failure_url: 'https://mind-link.fr/connexion-erreur'
      })
    });

    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch {}

    if (!r.ok) {
      // renvoyer l'erreur brute pour debug immédiat
      return res.status(r.status || 500).send(raw || `Nango connect session error (${r.status})`);
    }

    const connectLink = data?.data?.connect_link || data?.connect_link;
    if (!connectLink) {
      return res.status(500).send(`Missing connect_link. Raw: ${raw}`);
    }

    // redirection vers l'écran de consentement du provider (HubSpot/Gmail)
    res.writeHead(307, { Location: connectLink });
    return res.end();
  } catch (e) {
    return res.status(500).send(`Server error: ${e?.message || String(e)}`);
  }
}
