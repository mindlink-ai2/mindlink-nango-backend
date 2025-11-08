// DEBUG ONLY
export default async function handler(req, res) {
  res.setHeader('x-mindlink-version', 'ping-3');
  return res.status(200).json({ ok: true, v: 'ping-3', method: req.method });
}
