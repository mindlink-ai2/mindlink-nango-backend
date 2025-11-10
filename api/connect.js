export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).send('Missing env NANGO_SECRET_KEY');

    const provider = req.query.provider?.toString().trim();
    const endUserId = req.query.endUserId?.toString().trim();
    const returnUrl = req.query.returnUrl?.toString().trim() || '';

    if (!provider) return res.status(400).send('Missing provider');
    if (!endUserId) return res.status(400).send('Missing endUserId');

    // 👉 URL API (PAS hosted connect)
    const connectUrl = new URL('https://api.nango.dev/oauth/connect');
    connectUrl.searchParams.set('provider_config_key', provider);
    connectUrl.searchParams.set('end_user', endUserId);
    connectUrl.searchParams.set('connection_id', `${provider}-${endUserId}`);
    if (returnUrl) connectUrl.searchParams.set('return_url', returnUrl);

    res.writeHead(302, { Location: connectUrl.toString() });
    return res.end();

  } catch (e) {
    return res.status(500).send(`CONNECT_ERROR: ${e.message}`);
  }
}
