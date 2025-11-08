// api/nango-session-token.js
import { Nango } from '@nangohq/node';

export default async function handler(req, res) {
  // CORS basique
  res.setHeader('Access-Control-Allow-Origin', '*'); // remplace par ton domaine Framer si besoin
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const secret = process.env.NANGO_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: 'MISSING_ENV_NANGO_SECRET_KEY' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const endUserId = String(body?.endUserId || 'ML000001');
    const email = body?.email;
    const displayName = body?.displayName;
    const tags = body?.tags || { project: 'mindlink' };

    const nango = new Nango({
      secretKey: secret,
      host: process.env.NANGO_HOST || undefined // laisse vide si Nango Cloud
    });

    const session = await nango.createConnectSession({
      end_user: { id: endUserId, email, display_name: displayName, tags }
      // allowed_integrations: ['hubspot'] // ajoute plus tard si tu veux filtrer
    });

    const token = session?.token ?? session?.data?.token;
    if (!token) return res.status(500).json({ error: 'NANGO_NO_TOKEN', raw: session });

    return res.status(200).json({ sessionToken: token, endUserId });
  } catch (err) {
    return res.status(500).json({
      error: 'SESSION_TOKEN_ERROR',
      message: err?.message,
      nango: err?.response?.data
    });
  }
}
