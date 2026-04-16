import { NextRequest, NextResponse } from 'next/server';
import { getWooCategories } from '@/services/wooService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('store_id');
    if (!storeId) {
      return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
    }
    const categories = await getWooCategories(Number(storeId));
    return NextResponse.json({ categories });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
