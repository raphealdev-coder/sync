import { NextRequest, NextResponse } from 'next/server';
import { getEposLocations } from '@/services/eposService';

export async function GET(req: NextRequest) {
  try {
    const storeId = Number(new URL(req.url).searchParams.get('store_id')) || undefined;
    const locations = await getEposLocations(storeId);
    return NextResponse.json({
      locations: locations.map((l) => ({
        id: l.Id,
        name: l.Name,
        city: l.City,
        postCode: l.PostCode,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
