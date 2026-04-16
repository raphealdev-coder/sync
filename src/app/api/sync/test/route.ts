import { NextRequest, NextResponse } from 'next/server';
import { testEposConnection } from '@/services/eposService';
import { testWooConnection } from '@/services/wooService';
import { getWooStores } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('store_id');

  if (storeId) {
    const epos = await testEposConnection(Number(storeId));
    const woo = await testWooConnection(Number(storeId));
    return NextResponse.json({ wooStores: { [storeId]: { epos, woo } } });
  }

  // Test all stores
  const stores = await getWooStores();
  const wooStores: Record<number, { epos: boolean; woo: boolean }> = {};
  for (const store of stores) {
    let epos = false;
    if (store.epos_app_id) {
      try { epos = await testEposConnection(store.id); } catch { /* no creds */ }
    }
    const woo = await testWooConnection(store.id);
    wooStores[store.id] = { epos, woo };
  }
  return NextResponse.json({ wooStores });
}
