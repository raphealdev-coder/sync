import { NextRequest, NextResponse } from 'next/server';
import { testEposConnection } from '@/services/eposService';
import { testWooConnection } from '@/services/wooService';
import { getWooStores } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('store_id');

  const epos = await testEposConnection();

  if (storeId) {
    const woo = await testWooConnection(Number(storeId));
    return NextResponse.json({ epos, woo });
  }

  // Test all stores
  const stores = getWooStores();
  const wooResults: Record<number, boolean> = {};
  for (const store of stores) {
    wooResults[store.id] = await testWooConnection(store.id);
  }
  return NextResponse.json({ epos, wooStores: wooResults });
}
