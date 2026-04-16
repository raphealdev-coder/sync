import { NextRequest, NextResponse } from 'next/server';
import { getEposCustomers } from '@/services/eposService';

export async function GET(req: NextRequest) {
  try {
    const storeId = Number(new URL(req.url).searchParams.get('store_id')) || undefined;
    const customers = await getEposCustomers(storeId);
    return NextResponse.json({ customers });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
