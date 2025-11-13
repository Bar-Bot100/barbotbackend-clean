import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Missing code from Square" });
  }

  return res.json({ message: "Square OAuth successful", code });
}
