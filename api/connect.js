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

  const provider  = (req.query.provider || '').toString().trim();             // ex: "hubspot" | "google-mail-gzeg"
  const endUserId = (req.query.endUserId || req.query.end_user || '').toString().trim(); // ex: "{user.id}"

  if (!provider)  return res.status(400).send('Missing provider');
  if (!endUserId) return res.status(400).send('Missing endUserId');

  try {
    const r = await fetch('https://api.nango.dev/connect/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        end_user: endUserId,
        provider_config_key: provider
      })
    });

    const raw = await r.text(); // récupère toujours le corps
    // Essaie de parser, sinon garde le texte
    let data; try { data = JSON.parse(raw); } catch {}

    if (!r.ok) {
      // >>> Important: renvoyer l'erreur brute pour diagnostiquer
      return res.status(r.status || 500).send(raw || `Nango connect session error (${r.status})`);
    }

    const link = data?.data?.connect_link || data?.connect_link;
    if (!link) {
      return res.status(500).send(`Missing connect_link. Raw: ${raw}`);
    }

    res.writeHead(307, { Location: link });
    return res.end();
  } catch (e) {
    return res.status(500).send(`Server error: ${e?.message || String(e)}`);
  }
}
