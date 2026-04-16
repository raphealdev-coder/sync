import { NextRequest, NextResponse } from 'next/server';
import { getQueueItems, addQueueItem, updateQueueItemStatus, getQueueStats } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queueType = searchParams.get('type');
    const storeId = searchParams.get('store_id');
    const statsOnly = searchParams.get('stats');

    if (!queueType) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    if (statsOnly === '1') {
      const stats = await getQueueStats(queueType);
      return NextResponse.json({ stats });
    }

    const items = storeId
      ? await getQueueItems(queueType, Number(storeId))
      : await getQueueItems(queueType);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { queue_type, store_id, title, reference_id, payload } = body;

    if (!queue_type || !store_id || !title) {
      return NextResponse.json({ error: 'queue_type, store_id, and title are required' }, { status: 400 });
    }

    const item = await addQueueItem(queue_type, Number(store_id), title, reference_id, payload);
    return NextResponse.json({ success: true, item });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, result, error } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    await updateQueueItemStatus(Number(id), status, result, error);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
