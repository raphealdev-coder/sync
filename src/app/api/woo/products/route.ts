import { NextRequest, NextResponse } from 'next/server';
import { getWooProducts } from '@/services/wooService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = Number(searchParams.get('store_id'));
    if (!storeId) {
      return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
    }
    const products = await getWooProducts(storeId);
    const cleaned = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku ?? '',
      regularPrice: p.regular_price ?? '',
      salePrice: p.sale_price ?? '',
      stockQuantity: p.stock_quantity ?? null,
      stockStatus: p.stock_status ?? '',
      type: p.type ?? 'simple',
      status: p.status ?? '',
      manageStock: p.manage_stock ?? false,
      parentId: p.parent_id ?? 0,
    }));
    return NextResponse.json({ products: cleaned });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
