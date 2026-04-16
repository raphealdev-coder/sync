import { NextRequest, NextResponse } from 'next/server';
import { getRecentOrders, syncOrdersWooToEpos } from '@/services/syncService';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const storeId = Number(body.store_id);
    if (!storeId) {
      return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
    }
    const result = await syncOrdersWooToEpos(storeId);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
