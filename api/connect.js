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

  const provider  = (req.query.provider || '').toString().trim();             // "hubspot" | "google-mail-gzeg"
  const endUserId = (req.query.endUserId || req.query.end_user || '').toString().trim(); // "{user.id}"
  const debug     = ['1','diag','deep'].includes((req.query.debug || '').toString());

  if (!provider)  return res.status(400).send('Missing provider');
  if (!endUserId) return res.status(400).send('Missing endUserId');

  try {
    const r = await fetch('https://api.nango.dev/connect/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        end_user: endUserId,
        provider_config_key: provider
      })
    });

    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch {}
    if (!r.ok) return res.status(debug ? r.status : 500).send(debug ? (raw || 'Nango connect session error') : `Nango session error (${r.status})`);

    const link = data?.data?.connect_link || data?.connect_link;
    if (!link) return res.status(500).send(debug ? JSON.stringify(data || raw) : 'Missing connect_link');

    res.writeHead(307, { Location: link });
    return res.end();
  } catch (e) {
    return res.status(500).send(debug ? (e?.stack || String(e)) : 'Server error');
  }
}
