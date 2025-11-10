// /pages/api/connect.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const secret = process.env.NANGO_SECRET_KEY;
  if (!secret) return res.status(500).send('Missing env NANGO_SECRET_KEY');

  const provider  = (req.query.provider || '').toString().trim();           // e.g. google-mail-gzeg or hubspot-ml
  const endUserId = (req.query.endUserId || '').toString().trim();          // your user id, e.g. ML_123
  const returnUrl = (req.query.returnUrl || '').toString().trim();          // optional
  if (!provider) return res.status(400).send('Missing provider');
  if (!endUserId) return res.status(400).send('Missing endUserId');

  // 1) Ensure user exists in Nango (idempotent)
  await fetch('https://api.nango.dev/v1/users', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ internal_id: endUserId })
  });

  // 2) Redirect to the API connect endpoint (no public key needed)
  const url = new URL('https://api.nango.dev/oauth/connect');
  url.searchParams.set('provider_config_key', provider);
  url.searchParams.set('end_user', endUserId);
  url.searchParams.set('connection_id', `${provider}-${endUserId}`);
  if (returnUrl) url.searchParams.set('return_url', returnUrl);

  res.writeHead(302, { Location: url.toString() });
  return res.end();
}
