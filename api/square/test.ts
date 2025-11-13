import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase env vars (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1) Get the most recent Square token from Supabase
    const { data, error } = await supabase
      .from('square_tokens')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.error('Error loading token from Supabase:', error);
      return res.status(500).json({
        error: 'Failed to load Square token from Supabase',
        details: error?.message ?? 'No token row found',
      });
    }

    const accessToken = data.access_token as string;

    // 2) Call Square API to list locations (simple, safe test)
    const squareResponse = await fetch('https://connect.squareup.com/v2/locations', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-18',
      },
    });

    const squareBody = await squareResponse.json();

    if (!squareResponse.ok) {
      console.error('Square API error:', squareResponse.status, squareBody);
      return res.status(500).json({
        error: 'Square API returned an error',
        status: squareResponse.status,
        body: squareBody,
      });
    }

    // 3) Return a friendly result
    return res.status(200).json({
      message: 'Square + Supabase test OK',
      merchant_id: data.merchant_id,
      locations: squareBody,
    });
  } catch (err: any) {
    console.error('Unexpected error in /api/square/test:', err);
    return res.status(500).json({
      error: 'Unexpected server error',
      details: err?.message ?? String(err),
    });
  }
}
