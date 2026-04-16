import { NextRequest, NextResponse } from 'next/server';
import { syncInventoryEposToWoo } from '@/services/syncService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const storeId = Number(body.store_id);
    if (!storeId) {
      return NextResponse.json({ success: false, error: 'store_id is required' }, { status: 400 });
    }
    const result = await syncInventoryEposToWoo(storeId);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
