import type { VercelRequest, VercelResponse } from '@vercel/node';

const SQUARE_OAUTH_AUTHORIZE_URL =
  'https://connect.squareup.com/oauth2/authorize';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { SQUARE_CLIENT_ID, SQUARE_REDIRECT_URL } = process.env;

  if (!SQUARE_CLIENT_ID || !SQUARE_REDIRECT_URL) {
    return res
      .status(500)
      .json({ error: 'Missing Square env vars' });
  }

  // ✅ scopes we request from Square
  const scopes = [
    'MERCHANT_PROFILE_READ', // <-- new one!
    'ITEMS_READ',
    'ITEMS_WRITE',
    'ORDERS_READ',
    'ORDERS_WRITE',
    'PAYMENTS_READ',
    'PAYMENTS_WRITE',
  ].join('+');

  const redirectUrl = `${SQUARE_OAUTH_AUTHORIZE_URL}?client_id=${SQUARE_CLIENT_ID}&scope=${scopes}&session=false&state=barbot-oauth&redirect_uri=${encodeURIComponent(
    SQUARE_REDIRECT_URL,
  )}`;

  return res.redirect(redirectUrl);
}
