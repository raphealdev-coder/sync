import { NextRequest, NextResponse } from 'next/server';
import { getRecentOrders } from '@/services/syncService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = Number(searchParams.get('store_id'));
    if (!storeId) {
      return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
    }
    const orders = await getRecentOrders(storeId);
    return NextResponse.json({ orders });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
