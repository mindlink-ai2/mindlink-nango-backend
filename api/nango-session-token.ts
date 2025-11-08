import { VercelRequest, VercelResponse } from '@vercel/node';
import { Nango } from '@nangohq/node';

const nango = new Nango({ secretKey: process.env.NANGO_SECRET_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const endUserId =
      (req.method === 'POST'
        ? (req.body as any)?.endUserId
        : (req.query?.endUserId as string)) || 'ML000001';

    const allowed_integrations = ['hubspot-vnna'];

    const resp = await nango.createConnectSession({
      end_user: { id: String(endUserId) },
      allowed_integrations
    });

    res.status(200).json({ sessionToken: resp.data.token, endUserId });
  } catch (err: any) {
    console.error('Nango session token error:', err?.response?.data || err?.message || err);
    res.status(500).json({ error: 'SESSION_TOKEN_ERROR' });
  }
}
