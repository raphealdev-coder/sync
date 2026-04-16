import { NextResponse } from 'next/server';
import { testEposConnection } from '@/services/eposService';
import { testWooConnection } from '@/services/wooService';
import { getDashboardStats } from '@/services/syncService';
import { getSetting, getWooStores, getCategoryMappings } from '@/lib/db';

export async function GET() {
  try {
    const stores = await getWooStores();
    const wooConfigured = stores.length > 0;

    // Check if any store has ePOS credentials, or if global creds exist
    const hasGlobalEpos = !!((await getSetting('epos_app_id')) && (await getSetting('epos_app_secret')));
    const hasAnyEpos = hasGlobalEpos || stores.some((s) => s.epos_app_id && s.epos_app_secret);

    let anyEposConnected = false;
    const storeStatuses: Array<{ id: number; name: string; wooConnected: boolean; eposConnected: boolean }> = [];
    for (const store of stores) {
      const wooConnected = await testWooConnection(store.id);
      let eposConnected = false;
      if (store.epos_app_id && store.epos_app_secret) {
        eposConnected = await testEposConnection(store.id);
      } else if (hasGlobalEpos) {
        eposConnected = await testEposConnection();
      }
      if (eposConnected) anyEposConnected = true;
      storeStatuses.push({ id: store.id, name: store.name, wooConnected, eposConnected });
    }

    const anyWooConnected = storeStatuses.some((s) => s.wooConnected);
    const mappedCategories = (await getCategoryMappings()).length;

    const stats = await getDashboardStats();
    return NextResponse.json({
      ...stats,
      eposConnected: anyEposConnected,
      wooConnected: anyWooConnected,
      eposConfigured: hasAnyEpos,
      wooConfigured,
      mappedCategories,
      stores: storeStatuses,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
