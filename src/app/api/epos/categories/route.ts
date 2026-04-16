import { NextRequest, NextResponse } from 'next/server';
import { getEposCategories } from '@/services/eposService';

export async function GET(req: NextRequest) {
  try {
    const storeId = Number(new URL(req.url).searchParams.get('store_id')) || undefined;
    const categories = await getEposCategories(storeId);
    return NextResponse.json({ categories });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
