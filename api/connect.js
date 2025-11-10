export default async function handler(req, res) {
  // GET /api/connect?endUserId=CLIENT_ID&returnUrl=https://mind-link.fr/connected
  const secret = process.env.NANGO_SECRET_KEY;
  if (!secret) return res.status(500).send('Missing NANGO_SECRET_KEY');

  const endUserId = String(req.query.endUserId || 'demo');
  const returnUrl = (req.query.returnUrl || '').toString();
  const host = process.env.NANGO_HOST || 'https://api.nango.dev';

  // ⚠️ Mets ici EXACTEMENT la clé de ton intégration HubSpot dans Nango
  const PROVIDER = process.env.NANGO_HUBSPOT_KEY || 'hubspot-ml';

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` };

  // 1) Upsert user (évite unknown_user_account)
  await fetch(`${host}/v1/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: endUserId })
  });

  // 2) Redirection directe vers l’OAuth HubSpot
  const url = new URL(`${host}/oauth/connect`);
  url.searchParams.set('provider_config_key', PROVIDER);         // ex: hubspot-ml ou hubspot
  url.searchParams.set('end_user', endUserId);                   // même ID que ci-dessus
  url.searchParams.set('connection_id', `${PROVIDER}-${endUserId}`);
  if (returnUrl) url.searchParams.set('return_url', returnUrl);

  res.writeHead(302, { Location: url.toString() });
  res.end();
}
