import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

const SETTING_KEYS = [
  'epos_app_id',
  'epos_app_secret',
  // Sync direction / master settings
  'stock_master',
  'product_master',
  // Customer sync
  'customer_sync_enabled',
  'default_sync_customer_id',
  // Location
  'epos_location_id',
  // Product sync
  'product_match_field',
  'product_delete_action',
  'product_default_status',
  'price_sync_enabled',
  // Transaction
  'transaction_details_enabled',
];

const SECRET_KEYS = ['epos_app_secret'];

export async function GET() {
  const settings: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    const val = await getSetting(key);
    if (val) {
      if (SECRET_KEYS.includes(key)) {
        settings[key] = '••••••••' + val.slice(-4);
      } else {
        settings[key] = val;
      }
    }
  }
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    for (const key of SETTING_KEYS) {
      if (key in body && body[key] !== undefined) {
        const value = String(body[key]).trim();
        // Skip if value looks like a masked placeholder
        if (value.includes('••••')) continue;
        if (value) {
          await setSetting(key, value);
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
