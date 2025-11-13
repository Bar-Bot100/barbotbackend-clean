// api/auth/square/connect.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.SQUARE_CLIENT_ID;
  const redirectUrl = process.env.SQUARE_REDIRECT_URL;

  if (!clientId || !redirectUrl) {
    return res.status(500).json({
      error: 'Missing Square env vars',
      details: {
        SQUARE_CLIENT_ID: !!clientId,
        SQUARE_REDIRECT_URL: !!redirectUrl,
      },
    });
  }

  // 👇 IMPORTANT: include MERCHANT_PROFILE_READ here
  const scopes = [
    'ITEMS_READ',
    'ITEMS_WRITE',
    'ORDERS_READ',
    'ORDERS_WRITE',
    'PAYMENTS_READ',
    'PAYMENTS_WRITE',
    'MERCHANT_PROFILE_READ',
  ];

  const state = Math.random().toString(36).slice(2);

  const url = new URL('https://connect.squareup.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scopes.join(' ')); // space-separated, will show up as + in the URL
  url.searchParams.set('session', 'false');
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', redirectUrl);

  // Redirect the browser to Square’s OAuth screen
  res.redirect(url.toString());
}
