import { NextRequest, NextResponse } from 'next/server';
import { getWooStores, createWooStore, updateWooStore, deleteWooStore, getWooStore } from '@/lib/db';

export async function GET() {
  const stores = getWooStores();
  // Mask secrets
  const masked = stores.map((s) => ({
    ...s,
    consumer_key: '••••••••' + s.consumer_key.slice(-4),
    consumer_secret: '••••••••' + s.consumer_secret.slice(-4),
  }));
  return NextResponse.json({ stores: masked });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, site_url, consumer_key, consumer_secret } = body;

    if (!name || !site_url || !consumer_key || !consumer_secret) {
      return NextResponse.json(
        { error: 'name, site_url, consumer_key, and consumer_secret are required' },
        { status: 400 }
      );
    }

    if (id) {
      // Update existing store - skip masked values
      const existing = getWooStore(Number(id));
      if (!existing) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
      const finalKey = consumer_key.includes('••••') ? existing.consumer_key : String(consumer_key).trim();
      const finalSecret = consumer_secret.includes('••••') ? existing.consumer_secret : String(consumer_secret).trim();
      updateWooStore(Number(id), String(name).trim(), String(site_url).trim(), finalKey, finalSecret);
      return NextResponse.json({ success: true });
    } else {
      // Create new store
      const store = createWooStore(
        String(name).trim(),
        String(site_url).trim(),
        String(consumer_key).trim(),
        String(consumer_secret).trim()
      );
      return NextResponse.json({ success: true, store: { ...store, consumer_key: '••••••••' + store.consumer_key.slice(-4), consumer_secret: '••••••••' + store.consumer_secret.slice(-4) } });
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
    deleteWooStore(Number(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
