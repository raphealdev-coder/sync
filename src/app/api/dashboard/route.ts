import { NextResponse } from 'next/server';
import { testEposConnection } from '@/services/eposService';
import { testWooConnection } from '@/services/wooService';
import { getDashboardStats } from '@/services/syncService';
import { getSetting, getWooStores } from '@/lib/db';

export async function GET() {
  try {
    const eposConfigured = !!(getSetting('epos_app_id') && getSetting('epos_app_secret'));
    const stores = getWooStores();
    const wooConfigured = stores.length > 0;

    const eposConnected = eposConfigured ? await testEposConnection() : false;

    const storeStatuses: Array<{ id: number; name: string; connected: boolean }> = [];
    for (const store of stores) {
      const connected = await testWooConnection(store.id);
      storeStatuses.push({ id: store.id, name: store.name, connected });
    }

    const anyWooConnected = storeStatuses.some((s) => s.connected);

    const stats = await getDashboardStats();
    return NextResponse.json({
      ...stats,
      eposConnected,
      wooConnected: anyWooConnected,
      eposConfigured,
      wooConfigured,
      stores: storeStatuses,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
