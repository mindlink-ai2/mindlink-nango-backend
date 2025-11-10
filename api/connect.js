// pages/api/connect.js
export default async function handler(req, res) {
  // CORS + no-cache
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const secret = process.env.NANGO_SECRET_KEY; // <-- TA CLÉ EST LUE ICI, JAMAIS DANS LE CODE
  if (!secret) return res.status(500).send('Missing env NANGO_SECRET_KEY');

  const provider  = (req.query.provider || '').toString().trim();
  const endUserId = (req.query.endUserId || '').toString().trim();
  const debug     = req.query.debug === '1' || req.query.debug === 'diag' || req.query.debug === 'deep';

  if (!provider)  return res.status(400).send('Missing provider');
  if (!endUserId) return res.status(400).send('Missing endUserId');

  try {
    const r = await fetch('https://api.nango.dev/connect/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        end_user: endUserId,
        provider_config_key: provider
      })
    });

    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch {}

    if (!r.ok) return res.status(500).send(debug ? text : `Nango session error (${r.status})`);

    const link = data?.data?.connect_link || data?.connect_link;
    if (!link) return res.status(500).send(debug ? JSON.stringify(data || text) : 'Missing connect_link');

    res.writeHead(307, { Location: link });
    return res.end();

  } catch (e) {
    return res.status(500).send(debug ? e.stack || String(e) : 'Server error');
  }
}
