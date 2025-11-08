export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: 'MISSING_ENV_NANGO_SECRET_KEY' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const endUserId = String(body?.endUserId || 'ML000001');
    const provider = String(body?.provider || '').trim();
    if (!provider) return res.status(400).json({ error: 'MISSING_PROVIDER' });

    const host = process.env.NANGO_HOST || 'https://api.nango.dev';

    const resp = await fetch(`${host}/connect/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
      body: JSON.stringify({
        end_user: { id: endUserId },
        allowed_integrations: [provider]
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.token) return res.status(500).json({ error: 'NANGO_API_ERROR', nango: data });

    return res.status(200).json({ sessionToken: data.token, endUserId, provider });
  } catch (e) {
    return res.status(500).json({ error: 'SESSION_TOKEN_ERROR', message: e?.message });
  }
}
