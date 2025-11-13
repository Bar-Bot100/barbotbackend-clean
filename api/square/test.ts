// api/square/test.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Get latest token
    const { data, error } = await supabase
      .from('square_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return res.status(500).json({
        error: 'Failed to load Square token from Supabase',
        details: error?.message ?? 'No rows in square_tokens',
      });
    }

    const accessToken = data.access_token as string;

    const sqRes = await fetch(
      'https://connect.squareup.com/v2/merchants/me',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-08-21',
        },
      }
    );

    const body = await sqRes.json();

    if (!sqRes.ok) {
      return res.status(sqRes.status).json({
        error: 'Square API returned an error',
        status: sqRes.status,
        body,
      });
    }

    return res.status(200).json(body);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Unexpected error in /api/square/test',
      details: err?.message ?? String(err),
    });
  }
}
