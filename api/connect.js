export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    route: "connect",
    query: req.query
  });
}
