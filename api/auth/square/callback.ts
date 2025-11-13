// api/auth/square/callback.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase env vars');
}

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res
      .status(400)
      .json({ error: 'Missing "code" from Square OAuth callback' });
  }

  const clientId = process.env.SQUARE_CLIENT_ID;
  const clientSecret = process.env.SQUARE_CLIENT_SECRET;
  const redirectUrl = process.env.SQUARE_REDIRECT_URL;

  if (!clientId || !clientSecret || !redirectUrl) {
    return res.status(500).json({
      error: 'Missing Square env vars',
      details: {
        SQUARE_CLIENT_ID: !!clientId,
        SQUARE_CLIENT_SECRET: !!clientSecret,
        SQUARE_REDIRECT_URL: !!redirectUrl,
      },
    });
  }

  // Exchange the auth "code" for tokens
  const tokenRes = await fetch('https://connect.squareup.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUrl,
    }),
  });

  const tokenJson = await tokenRes.json();

  if (!tokenRes.ok || tokenJson.errors) {
    return res.status(500).json({
      error: 'Failed to exchange code for token',
      body: tokenJson,
    });
  }

  // tokenJson has: access_token, token_type, expires_at, merchant_id, refresh_token, short_lived
  const tokens = tokenJson;

  if (!supabase) {
    // Supabase misconfigured – still show tokens so you can copy them if needed
    return res.status(200).json({
      message: 'Square OAuth successful (Supabase not configured)',
      tokens,
    });
  }

  // Save / update latest tokens for this merchant
  const { error } = await supabase
    .from('square_tokens')
    .upsert(
      {
        merchant_id: tokens.merchant_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at,
        short_lived: tokens.short_lived,
      },
      { onConflict: 'merchant_id' }
    );

  if (error) {
    return res.status(500).json({
      error: 'Failed to save tokens in Supabase',
      details: error.message,
    });
  }

  // ✅ Success – tokens are stored
  return res.status(200).json({
    message: 'Square OAuth successful',
    tokens,
  });
}
