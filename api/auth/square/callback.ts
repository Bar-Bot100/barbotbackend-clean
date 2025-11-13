import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing code from Square" });
  }

  const clientId = process.env.SQUARE_CLIENT_ID;
  const clientSecret = process.env.SQUARE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Missing Square client credentials" });
  }

  try {
    // Call Square OAuth token endpoint (PRODUCTION)
    const response = await fetch("https://connect.squareup.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to exchange code for token",
        details: data
      });
    }

    // ⚠️ access_token is VERY sensitive – don’t log it in a real app.
    // For now we return it so you can see it works.
    return res.status(200).json({
      message: "Square OAuth token obtained",
      merchant_id: data.merchant_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Unexpected error", details: err?.message });
  }
}
