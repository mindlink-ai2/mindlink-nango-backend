// api/connect.js
export default async function handler(req, res) {
  // CORS + no-cache
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: 'Missing env NANGO_SECRET_KEY' });

    // parse URL correctement
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    const integrationId =
      (urlObj.searchParams.get('provider') || urlObj.searchParams.get('integration_id') || '').trim();
    const endUserId =
      (urlObj.searchParams.get('endUserId') || urlObj.searchParams.get('end_user') || '').trim();

    if (!integrationId) return res.status(400).json({ error: 'Missing provider/integration_id' });
    if (!endUserId)     return res.status(400).json({ error: 'Missing endUserId' });

    // --- Appel Nango v1 ---
    const called = 'https://api.nango.dev/v1/connect/sessions';
    const r = await fetch(called, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'provider-config-key': integrationId // ✅ seul header à passer !
      },
      body: JSON.stringify({
        end_user: { id: endUserId }
      })
    });

    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch {}

    if (!r.ok) {
      return res.status(r.status || 500).json({ called, status: r.status, raw });
    }

    const link = data?.data?.connect_link || data?.connect_link;
    if (!link) {
      return res.status(500).json({ called, error: 'Missing connect_link', raw: data || raw });
    }

    res.writeHead(307, { Location: link });
    return res.end();

  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: e?.message || String(e) });
  }
}
