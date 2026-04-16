import { NextRequest, NextResponse } from 'next/server';
import { getWooStores, createWooStore, updateWooStore, deleteWooStore, getWooStore } from '@/lib/db';

export async function GET() {
  const stores = await getWooStores();
  // Mask secrets
  const masked = stores.map((s) => ({
    ...s,
    consumer_key: '••••••••' + s.consumer_key.slice(-4),
    consumer_secret: '••••••••' + s.consumer_secret.slice(-4),
    epos_app_id: s.epos_app_id ?? '',
    epos_app_secret: s.epos_app_secret ? '••••••••' + s.epos_app_secret.slice(-4) : '',
    epos_location_id: s.epos_location_id ?? '',
    slms_store_slug: s.slms_store_slug ?? '',
  }));
  return NextResponse.json({ stores: masked });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, site_url, consumer_key, consumer_secret, epos_app_id, epos_app_secret, epos_location_id, slms_store_slug } = body;

    if (!name || !site_url || !consumer_key || !consumer_secret) {
      return NextResponse.json(
        { error: 'name, site_url, consumer_key, and consumer_secret are required' },
        { status: 400 }
      );
    }

    if (id) {
      // Update existing store - skip masked values
      const existing = await getWooStore(Number(id));
      if (!existing) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
      const finalKey = consumer_key.includes('••••') ? existing.consumer_key : String(consumer_key).trim();
      const finalSecret = consumer_secret.includes('••••') ? existing.consumer_secret : String(consumer_secret).trim();
      const finalEposId = epos_app_id !== undefined ? String(epos_app_id).trim() || undefined : existing.epos_app_id ?? undefined;
      const finalEposSecret = epos_app_secret && !epos_app_secret.includes('••••')
        ? String(epos_app_secret).trim()
        : existing.epos_app_secret ?? undefined;
      const finalEposLocation = epos_location_id !== undefined ? String(epos_location_id).trim() || undefined : existing.epos_location_id ?? undefined;
      const finalSlmsStoreSlug = slms_store_slug !== undefined ? String(slms_store_slug).trim() || undefined : existing.slms_store_slug ?? undefined;
      await updateWooStore(Number(id), String(name).trim(), String(site_url).trim(), finalKey, finalSecret, finalEposId, finalEposSecret, finalEposLocation, finalSlmsStoreSlug);
      return NextResponse.json({ success: true });
    } else {
      // Create new store
      const store = await createWooStore(
        String(name).trim(),
        String(site_url).trim(),
        String(consumer_key).trim(),
        String(consumer_secret).trim(),
        epos_app_id ? String(epos_app_id).trim() : undefined,
        epos_app_secret ? String(epos_app_secret).trim() : undefined,
        epos_location_id ? String(epos_location_id).trim() : undefined,
        slms_store_slug ? String(slms_store_slug).trim() : undefined
      );
      return NextResponse.json({
        success: true,
        store: {
          ...store,
          consumer_key: '••••••••' + store.consumer_key.slice(-4),
          consumer_secret: '••••••••' + store.consumer_secret.slice(-4),
          epos_app_secret: store.epos_app_secret ? '••••••••' + store.epos_app_secret.slice(-4) : '',
        },
      });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await deleteWooStore(Number(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
