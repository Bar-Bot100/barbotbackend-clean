import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).json({ error: "Missing code parameter" });
  }

  if (!process.env.SQUARE_CLIENT_ID || !process.env.SQUARE_CLIENT_SECRET || !process.env.SQUARE_REDIRECT_URL) {
    return res.status(500).json({ error: "Missing Square client credentials" });
  }

  try {
    const tokenRes = await fetch("https://connect.squareup.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: process.env.SQUARE_CLIENT_ID,
        client_secret: process.env.SQUARE_CLIENT_SECRET,
        code,
        redirect_uri: process.env.SQUARE_REDIRECT_URL, // <-- THIS FIXES THE ERROR
        grant_type: "authorization_code"
      })
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(500).json({
        error: "Failed to exchange code for token",
        details: data
      });
    }

    return res.status(200).json({
      message: "Square OAuth successful",
      tokens: data
    });

  } catch (err: any) {
    return res.status(500).json({ error: "Unexpected server error", detail: err.message });
  }
}
