import { Nango } from '@nangohq/node';

export default async function handler(req: any, res: any) {
  // CORS basique
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1) Vérifier l'env
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) {
      console.error('Missing NANGO_SECRET_KEY');
      return res.status(500).json({ error: 'MISSING_ENV_NANGO_SECRET_KEY' });
    }

    // 2) Parser le body de façon safe (Vercel peut passer req.body en string)
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { endUserId, email, displayName, tags } = body;

    // 3) Construire Nango
    const nango = new Nango({
      secretKey: secret,
      host: process.env.NANGO_HOST || undefined
    });

    // 4) Appel Nango (sans filtre d’intégrations pour éviter les slugs invalides)
    const session = await nango.createConnectSession({
      end_user: {
        id: String(endUserId || 'ML000001'),
        email,
        display_name: displayName,
        tags: tags || { project: 'mindlink' }
      }
    });

    const token = (session as any)?.token ?? (session as any)?.data?.token;
    if (!token) {
      console.error('No token returned by Nango:', session);
      return res.status(500).json({ error: 'NANGO_NO_TOKEN' });
    }

    return res.status(200).json({ sessionToken: token, endUserId: String(endUserId || 'ML000001') });
  } catch (err: any) {
    console.error('SESSION_TOKEN_ERROR:', err?.response?.data || err?.message || err);
    return res.status(500).json({ error: 'SESSION_TOKEN_ERROR' });
  }
}
