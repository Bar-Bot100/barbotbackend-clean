import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const LOCATION_IDS = [
  'LFGNGPYT8AT6X', // Ten1 Tapas
  'LGW3DHDSR4NS2', // Dickens
];

type LocationStats = {
  locationId: string;
  totalCents: number;
  cardCents: number;
  cashCents: number;
  otherCents: number;
  count: number;
};

function centsToEuros(cents: number): number {
  return Math.round((cents / 100) * 100) / 100;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1) Latest token
    const { data: tokenRow, error: tokenError } = await supabase
      .from('square_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return res.status(500).json({
        error: 'No Square token found in Supabase',
        details: tokenError?.message ?? 'square_tokens table is empty',
      });
    }

    const accessToken = tokenRow.access_token as string;

    // 2) Last 24 hours
    const now = new Date();
    const begin = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const beginIso = begin.toISOString();
    const endIso = now.toISOString();

    const perLocation: Record<string, LocationStats> = {};
    let combinedCents = 0;
    let combinedCardCents = 0;
    let combinedCashCents = 0;
    let combinedOtherCents = 0;
    let combinedCount = 0;

    for (const locationId of LOCATION_IDS) {
      const stats: LocationStats = {
        locationId,
        totalCents: 0,
        cardCents: 0,
        cashCents: 0,
        otherCents: 0,
        count: 0,
      };

      let cursor: string | undefined = undefined;
      let more = true;

      while (more) {
        const url = new URL('https://connect.squareup.com/v2/payments');
        url.searchParams.set('location_id', locationId);
        url.searchParams.set('begin_time', beginIso);
        url.searchParams.set('end_time', endIso);
        url.searchParams.set('sort_order', 'DESC');
        url.searchParams.set('limit', '100');
        if (cursor) url.searchParams.set('cursor', cursor);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-08-21',
          },
        });

        const body = await response.json();

        if (!response.ok) {
          return res.status(response.status).json({
            error: 'Square Payments API error',
            status: response.status,
            locationId,
            body,
          });
        }

        const payments = body.payments ?? [];
        for (const payment of payments) {
          if (payment.status !== 'COMPLETED') continue;
          const amountCents: number = payment.amount_money?.amount ?? 0;
          stats.totalCents += amountCents;
          stats.count += 1;

          if (payment.card_details) {
            stats.cardCents += amountCents;
          } else if (payment.cash_details) {
            stats.cashCents += amountCents;
          } else {
            stats.otherCents += amountCents;
          }
        }

        if (body.cursor) {
          cursor = body.cursor;
        } else {
          more = false;
        }
      }

      perLocation[locationId] = stats;
      combinedCents += stats.totalCents;
      combinedCardCents += stats.cardCents;
      combinedCashCents += stats.cashCents;
      combinedOtherCents += stats.otherCents;
      combinedCount += stats.count;
    }

    const totalEur = centsToEuros(combinedCents);
    const cardEur = centsToEuros(combinedCardCents);
    const cashEur = centsToEuros(combinedCashCents);
    const otherEur = centsToEuros(combinedOtherCents);

    const ten1 = perLocation['LFGNGPYT8AT6X'];
    const dickens = perLocation['LGW3DHDSR4NS2'];

    const ten1Total = centsToEuros(ten1?.totalCents ?? 0);
    const dickensTotal = centsToEuros(dickens?.totalCents ?? 0);

    const reportLines: string[] = [];

    reportLines.push(
      `Resumen de ventas (últimas 24 horas):`,
      ``,
      `• Total combinado (Ten1 + Dickens): €${totalEur.toFixed(2)} en ${combinedCount} ventas.`,
      `   - Tarjeta: €${cardEur.toFixed(2)}`,
      `   - Efectivo: €${cashEur.toFixed(2)}`,
      `   - Otros: €${otherEur.toFixed(2)}`,
      ``,
      `• Ten1 Tapas (LFGNGPYT8AT6X): €${ten1Total.toFixed(2)} (${ten1?.count ?? 0} ventas)`,
      `• Dickens (LGW3DHDSR4NS2): €${dickensTotal.toFixed(2)} (${dickens?.count ?? 0} ventas)`,
      ``,
      `Rango de tiempo:`,
      `   Desde: ${beginIso}`,
      `   Hasta: ${endIso}`
    );

    const report = reportLines.join('\n');

    return res.status(200).json({
      range: {
        type: 'last_24_hours',
        begin_iso: beginIso,
        end_iso: endIso,
      },
      report,
    });
  } catch (err: any) {
    console.error('Unexpected error in /api/square/daily-report:', err);
    return res.status(500).json({
      error: 'Unexpected server error',
      details: err?.message ?? String(err),
    });
  }
}
