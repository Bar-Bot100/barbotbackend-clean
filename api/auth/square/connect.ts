import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.SQUARE_CLIENT_ID;
  const redirectUrl = process.env.SQUARE_REDIRECT_URL;

  if (!clientId || !redirectUrl) {
    return res.status(500).json({ error: "Missing Square env vars" });
  }

  const url = `https://connect.squareupsandbox.com/oauth2/authorize?client_id=${clientId}&scope=ITEMS_READ+ITEMS_WRITE+ORDERS_READ+ORDERS_WRITE+PAYMENTS_READ+PAYMENTS_WRITE&session=false&redirect_uri=${redirectUrl}`;

  return res.redirect(url);
}
