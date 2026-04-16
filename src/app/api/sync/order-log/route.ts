import { NextRequest, NextResponse } from 'next/server';
import { getOrderSyncEntries } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = Number(searchParams.get('store_id'));
    if (!storeId) {
      return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
    }
    const limit = Number(searchParams.get('limit')) || 100;
    const entries = await getOrderSyncEntries(storeId, limit);
    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
