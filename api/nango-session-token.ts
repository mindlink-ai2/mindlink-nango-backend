import { Nango } from '@nangohq/node';

const nango = new Nango({
  secretKey: process.env.NANGO_SECRET_KEY!,
  host: process.env.NANGO_HOST || undefined // ne mets rien si Nango Cloud
});

// petit helper CORS
function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // remplace par ton domaine Framer si tu veux restreindre
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { endUserId, email, displayName, tags } = req.body || {};
    const allowed_integrations = ['hubspot']; // mets ici tes slugs Nango exacts (ex: 'hubspot', 'google-mail', etc.)

    const session = await nango.createConnectSession({
      end_user: {
        id: String(endUserId || 'ML000001'),
        email,
        display_name: displayName,
        tags: tags || { project: 'mindlink' }
      },
      allowed_integrations
    });

    // Certaines versions renvoient { token }, d'autres { data: { token } }
    const token = (session as any)?.token ?? (session as any)?.data?.token;
    if (!token) throw new Error('No token returned by Nango');

    return res.status(200).json({ sessionToken: token, endUserId: String(endUserId || 'ML000001') });
  } catch (err: any) {
    console.error('Nango session token error:', err?.response?.data || err?.message || err);
    return res.status(500).json({ error: 'SESSION_TOKEN_ERROR' });
  }
}
