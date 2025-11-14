import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const LOCATION_IDS = ['LFGNGPYT8AT6X', 'LGW3DHDSR4NS2']; // Ten1, Dickens
const SQUARE_ORDERS_URL = 'https://connect.squareup.com/v2/orders/search';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getLatestSquareToken() {
  const { data, error } = await supabase
    .from('square_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `No Square token found in Supabase: ${error?.message ?? 'no rows'}`
    );
  }

  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const tokenRow = await getLatestSquareToken();
    const accessToken = tokenRow.access_token as string;

    // Optional: ?days= in query, default 7
    const daysParam =
      typeof req.query.days === 'string' ? req.query.days : undefined;
    const days = daysParam ? Number(daysParam) : 7;

    if (Number.isNaN(days) || days <= 0) {
      return res
        .status(400)
        .json({ error: 'Invalid "days" parameter, must be positive number' });
    }

    const now = new Date();
    const end = now.toISOString();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    const start = startDate.toISOString();

    let importedOrders = 0;
    let importedItems = 0;
    let cursor: string | undefined = undefined;

    do {
      const body = {
        location_ids: LOCATION_IDS,
        cursor,
        query: {
          filter: {
            date_time_filter: {
              closed_at: {
                start_at: start,
                end_at: end,
              },
            },
            state_filter: {
              states: ['COMPLETED'],
            },
          },
        },
      };

      const response = await fetch(SQUARE_ORDERS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-08-21',
        },
        body: JSON.stringify(body),
      });

      const json = await response.json();

      if (!response.ok) {
        console.error('Square Orders API error', response.status, json);
        return res.status(response.status).json({
          error: 'Square Orders API error',
          status: response.status,
          body: json,
        });
      }

      const orders = json.orders ?? [];
      cursor = json.cursor;

      for (const order of orders) {
        if (!order.id) continue;

        const orderPayload = {
          square_order_id: order.id as string,
          merchant_id: tokenRow.merchant_id as string,
          location_id: (order.location_id ??
            order.locationId ??
            'UNKNOWN') as string,
          state: (order.state ?? null) as string | null,
          created_at_utc: (order.created_at ??
            order.createdAt ??
            null) as string | null,
          closed_at_utc: (order.closed_at ??
            order.closedAt ??
            null) as string | null,
          updated_at_utc: (order.updated_at ??
            order.updatedAt ??
            null) as string | null,
          total_money_cents: order.total_money?.amount ??
            order.totalMoney?.amount ??
            null,
          total_discount_cents: order.total_discount_money?.amount ??
            order.totalDiscountMoney?.amount ??
            null,
          total_tax_cents: order.total_tax_money?.amount ??
            order.totalTaxMoney?.amount ??
            null,
          total_tip_cents: order.total_tip_money?.amount ??
            order.totalTipMoney?.amount ??
            null,
        };

        const { data: orderRow, error: upsertErr } = await supabase
          .from('sales_orders')
          .upsert(orderPayload, { onConflict: 'square_order_id' })
          .select()
          .single();

        if (upsertErr || !orderRow) {
          console.error('Failed to upsert sales_orders', upsertErr);
          continue;
        }

        importedOrders += 1;

        // Clear old items for this order (safe to re-run)
        await supabase
          .from('sales_order_items')
          .delete()
          .eq('sales_order_id', orderRow.id);

        const lineItems = order.line_items ?? order.lineItems ?? [];
        const itemRows = lineItems.map((li: any) => ({
          sales_order_id: orderRow.id,
          catalog_object_id: li.catalog_object_id ?? li.catalogObjectId ?? null,
          sku: li.sku ?? null,
          item_name: li.name ?? null,
          variation_name: li.variation_name ?? li.variationName ?? null,
          quantity: li.quantity ? Number(li.quantity) : 0,
          gross_sales_cents: li.gross_sales_money?.amount ??
            li.grossSalesMoney?.amount ??
            null,
          discount_cents: li.total_discount_money?.amount ??
            li.totalDiscountMoney?.amount ??
            null,
          net_sales_cents: li.net_sales_money?.amount ??
            li.netSalesMoney?.amount ??
            null,
        }));

        if (itemRows.length > 0) {
          const { error: itemErr } = await supabase
            .from('sales_order_items')
            .insert(itemRows);

          if (itemErr) {
            console.error('Failed to insert sales_order_items', itemErr);
          } else {
            importedItems += itemRows.length;
          }
        }
      }
    } while (cursor);

    return res.status(200).json({
      ok: true,
      imported_orders: importedOrders,
      imported_items: importedItems,
      from: start,
      to: end,
      days,
    });
  } catch (err: any) {
    console.error('import-sales error', err);
    return res.status(500).json({
      error: 'Failed to import sales from Square',
      details: err?.message ?? String(err),
    });
  }
}
