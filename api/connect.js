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

  const integrationId = (req.query.provider || '').toString().trim();     // ex: "google-mail-gzeg" | "hubspot"
  const endUserId     = (req.query.endUserId || req.query.end_user || '').toString().trim();
  if (!integrationId) return res.status(400).send('Missing provider/integration_id');
  if (!endUserId)     return res.status(400).send('Missing endUserId');

  const url = 'https://api.nango.dev/v1/connect/sessions';
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        integration_id: integrationId,
        end_user: { id: endUserId }
      })
    });

    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch {}

    if (!r.ok) {
      // renvoie l’erreur brute + l’endpoint appelé pour diagnostic
      return res
        .status(r.status || 500)
        .send(JSON.stringify({ called: url, status: r.status, raw }, null, 2));
    }

    const connectLink = data?.data?.connect_link || data?.connect_link;
    if (!connectLink) {
      return res
        .status(500)
        .send(JSON.stringify({ called: url, error: 'Missing connect_link', raw: data || raw }, null, 2));
    }

    res.writeHead(307, { Location: connectLink });
    return res.end();
  } catch (e) {
    return res.status(500).send(JSON.stringify({ called: url, error: e?.message || String(e) }, null, 2));
  }
}
