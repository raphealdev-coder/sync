import { NextRequest, NextResponse } from 'next/server';
import {
  getEposWebhooks,
  subscribeEposWebhook,
  unsubscribeEposWebhook,
  updateEposWebhookBaseUrl,
} from '@/services/eposService';
import {
  getWebhookSubscriptions,
  upsertWebhookSubscription,
  deleteWebhookSubscription,
} from '@/lib/db';

// Webhook events we care about for stock/product sync
const WEBHOOK_EVENTS = [
  { type: 201, name: 'CreateProductStockDetail' },
  { type: 202, name: 'UpdateProductStockDetail' },
  { type: 121, name: 'CreateProduct' },
  { type: 122, name: 'UpdateProduct' },
  { type: 123, name: 'DeleteProduct' },
  { type: 304, name: 'CompleteTransaction' },
] as const;

/** GET — list webhook subscriptions for a store */
export async function GET(req: NextRequest) {
  try {
    const storeId = Number(new URL(req.url).searchParams.get('store_id'));
    if (!storeId) {
      return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
    }

    const local = await getWebhookSubscriptions(storeId);

    // Also fetch from ePOS to show current state
    let remote: Awaited<ReturnType<typeof getEposWebhooks>> = [];
    try {
      remote = await getEposWebhooks(storeId);
    } catch {
      // credentials may not be set
    }

    return NextResponse.json({
      subscriptions: local,
      remoteWebhooks: remote,
      availableEvents: WEBHOOK_EVENTS,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** POST — subscribe to webhook events for a store */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { store_id, base_url } = body;

    if (!store_id || !base_url) {
      return NextResponse.json({ error: 'store_id and base_url are required' }, { status: 400 });
    }

    const storeId = Number(store_id);
    const results: { event: string; success: boolean; error?: string }[] = [];

    // Diagnostic: fetch existing webhooks to see the current state and field names
    let existingWebhooks: unknown = null;
    try {
      existingWebhooks = await getEposWebhooks(storeId);
    } catch (err) {
      existingWebhooks = `GET failed: ${String(err)}`;
    }

    // First set the BaseUri on the device so RoutePath-based webhooks resolve correctly
    let baseUriResult = '';
    try {
      baseUriResult = await updateEposWebhookBaseUrl(base_url, storeId);
    } catch (err) {
      baseUriResult = String(err);
      results.push({ event: '_setBaseUri', success: false, error: String(err) });
    }

    for (const event of WEBHOOK_EVENTS) {
      const webhookUrl = `${base_url}/api/webhooks/epos?store_id=${storeId}&event=${event.type}`;
      try {
        const registered = await subscribeEposWebhook(event.type, webhookUrl, storeId);
        await upsertWebhookSubscription(
          storeId,
          event.type,
          event.name,
          webhookUrl,
          registered.Id ? String(registered.Id) : undefined
        );
        results.push({ event: event.name, success: true });
      } catch (err) {
        results.push({ event: event.name, success: false, error: String(err) });
      }
    }

    return NextResponse.json({ success: true, results, baseUriResult, existingWebhooks });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** DELETE — unsubscribe webhooks for a store */
export async function DELETE(req: NextRequest) {
  try {
    const storeId = Number(new URL(req.url).searchParams.get('store_id'));
    if (!storeId) {
      return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
    }

    const subs = await getWebhookSubscriptions(storeId);
    const results: { event: string; success: boolean; error?: string }[] = [];

    for (const sub of subs) {
      try {
        if (sub.epos_webhook_id) {
          await unsubscribeEposWebhook(Number(sub.epos_webhook_id), storeId);
        }
        await deleteWebhookSubscription(sub.id);
        results.push({ event: sub.event_name, success: true });
      } catch (err) {
        results.push({ event: sub.event_name, success: false, error: String(err) });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
