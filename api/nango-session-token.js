// api/nango-session-token.js
export default async function handler(req, res) {
  // CORS
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
    const provider = (body?.provider || '').toString().trim(); // <- peut être vide

    const host = process.env.NANGO_HOST || 'https://api.nango.dev';

    const payload = { end_user: { id: endUserId } };
    if (provider) payload.allowed_integrations = [provider]; // sinon picker Nango

    const resp = await fetch(`${host}/connect/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.token) return res.status(500).json({ error: 'NANGO_API_ERROR', nango: data });

    return res.status(200).json({ sessionToken: data.token, endUserId, provider: provider || null });
  } catch (e) {
    return res.status(500).json({ error: 'SESSION_TOKEN_ERROR', message: e?.message });
  }
}
