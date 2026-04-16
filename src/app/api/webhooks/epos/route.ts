import { NextRequest, NextResponse } from 'next/server';
import { addLog, getProductMappings, getWooStore } from '@/lib/db';
import { getEposProduct, getEposProductStocks } from '@/services/eposService';
import { updateWooProduct, batchUpdateWooProducts, updateSlmsStock, bulkUpdateSlmsStock } from '@/services/wooService';
import type { SlmsStockItem } from '@/services/wooService';

/**
 * Incoming webhook handler for ePOS Now events.
 * ePOS Now sends POST requests here when products/stock change.
 * URL format: /api/webhooks/epos?store_id=X&event=Y
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = Number(searchParams.get('store_id'));
    const eventType = Number(searchParams.get('event'));

    if (!storeId) {
      return NextResponse.json({ error: 'store_id required' }, { status: 400 });
    }

    const store = await getWooStore(storeId);

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      // Some webhook events may have empty bodies
    }

    await addLog('webhook', 'info', `Received ePOS webhook: event=${eventType} store=${storeId}`, body);

    switch (eventType) {
      // Stock change events — update WooCommerce stock for linked products
      case 201: // CreateProductStockDetail
      case 202: // UpdateProductStockDetail
        await handleStockUpdate(storeId, body);
        break;

      // Product events — update WooCommerce product details
      case 122: // UpdateProduct
        await handleProductUpdate(storeId, body);
        break;

      case 123: // DeleteProduct
        await handleProductDelete(storeId, body);
        break;

      case 304: // CompleteTransaction — stock may have changed
        await handleTransactionComplete(storeId, body);
        break;

      default:
        await addLog('webhook', 'info', `Unhandled ePOS webhook event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    await addLog('webhook', 'error', `Webhook handler error: ${err}`);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

interface WebhookPayload {
  Id?: number;
  ProductId?: number;
  [key: string]: unknown;
}

async function handleStockUpdate(storeId: number, body: unknown) {
  const payload = body as WebhookPayload;
  const productId = payload?.ProductId || payload?.Id;
  if (!productId) return;

  const mappings = await getProductMappings(storeId);
  const mapping = mappings.find((m) => m.epos_id === String(productId));
  if (!mapping) return;
  if (mapping.ignore_stock_update) return;

  try {
    // Fetch current stock from ePOS for this product
    const stocks = await getEposProductStocks(storeId);
    const store = await getWooStore(storeId);
    const locationSetting = store?.epos_location_id;
    const locationIds = locationSetting
      ? locationSetting.split(',').map((id) => Number(id.trim())).filter(Boolean)
      : [];

    let totalStock = 0;
    for (const s of stocks) {
      if (s.ProductId !== productId) continue;
      if (locationIds.length > 0 && !locationIds.includes(s.LocationId)) continue;
      totalStock += s.CurrentStock ?? 0;
    }

    const slmsStoreSlug = store?.slms_store_slug || null;

    if (slmsStoreSlug) {
      // Use SLMS per-store stock update
      await updateSlmsStock(storeId, mapping.woo_id, slmsStoreSlug, totalStock);
      await addLog('webhook', 'success', `SLMS stock updated via webhook: ePOS #${productId} → Woo #${mapping.woo_id} @ store "${slmsStoreSlug}" = ${totalStock}`);
    } else {
      // Standard WooCommerce stock update
      await batchUpdateWooProducts(storeId, [
        { id: mapping.woo_id, stock_quantity: totalStock, manage_stock: true },
      ]);
      await addLog('webhook', 'success', `Stock updated via webhook: ePOS #${productId} → Woo #${mapping.woo_id} = ${totalStock}`);
    }
  } catch (err) {
    await addLog('webhook', 'error', `Webhook stock update failed for product ${productId}: ${err}`);
  }
}

async function handleProductUpdate(storeId: number, body: unknown) {
  const payload = body as WebhookPayload;
  const productId = payload?.Id;
  if (!productId) return;

  const mappings = await getProductMappings(storeId);
  const mapping = mappings.find((m) => m.epos_id === String(productId));
  if (!mapping) return;

  try {
    const eposProduct = await getEposProduct(productId, storeId);
    await updateWooProduct(storeId, mapping.woo_id, {
      name: eposProduct.Name,
      regular_price: String(eposProduct.SalePrice ?? 0),
      description: eposProduct.Description ?? '',
    });

    await addLog('webhook', 'success', `Product updated via webhook: ePOS #${productId} "${eposProduct.Name}" → Woo #${mapping.woo_id}`);
  } catch (err) {
    await addLog('webhook', 'error', `Webhook product update failed for ${productId}: ${err}`);
  }
}

async function handleProductDelete(storeId: number, body: unknown) {
  const payload = body as WebhookPayload;
  const productId = payload?.Id;
  if (!productId) return;

  const mappings = await getProductMappings(storeId);
  const mapping = mappings.find((m) => m.epos_id === String(productId));
  if (!mapping) return;

  try {
    // Set to draft rather than delete — safer
    await updateWooProduct(storeId, mapping.woo_id, { status: 'draft' });
    await addLog('webhook', 'success', `Product set to draft via webhook: ePOS #${productId} → Woo #${mapping.woo_id}`);
  } catch (err) {
    await addLog('webhook', 'error', `Webhook product delete handling failed for ${productId}: ${err}`);
  }
}

async function handleTransactionComplete(storeId: number, _body: unknown) {
  // When a transaction completes in ePOS, stock levels change.
  // Rather than parsing every line item, do a bulk stock refresh for all mapped products.
  try {
    const mappings = await getProductMappings(storeId);
    if (mappings.length === 0) return;

    const stocks = await getEposProductStocks(storeId);
    const store = await getWooStore(storeId);
    const locationSetting = store?.epos_location_id;
    const locationIds = locationSetting
      ? locationSetting.split(',').map((id) => Number(id.trim())).filter(Boolean)
      : [];

    const stockByProductId = new Map<string, number>();
    for (const s of stocks) {
      if (locationIds.length > 0 && !locationIds.includes(s.LocationId)) continue;
      const key = String(s.ProductId);
      stockByProductId.set(key, (stockByProductId.get(key) ?? 0) + (s.CurrentStock ?? 0));
    }

    const slmsStoreSlug = store?.slms_store_slug || null;

    if (slmsStoreSlug) {
      // SLMS per-store stock bulk update
      const slmsItems: SlmsStockItem[] = [];
      for (const mapping of mappings) {
        if (mapping.ignore_stock_update) continue;
        const qty = stockByProductId.get(mapping.epos_id);
        if (qty !== undefined) {
          slmsItems.push({ product_id: mapping.woo_id, store: slmsStoreSlug, quantity: qty });
        }
      }
      if (slmsItems.length > 0) {
        for (let i = 0; i < slmsItems.length; i += 50) {
          await bulkUpdateSlmsStock(storeId, slmsItems.slice(i, i + 50));
        }
      }
      await addLog('webhook', 'success', `Transaction webhook: refreshed ${slmsItems.length} SLMS stock levels for store #${storeId}`);
    } else {
      // Standard WooCommerce stock update
      const updates: ({ id: number } & Record<string, unknown>)[] = [];
      for (const mapping of mappings) {
        if (mapping.ignore_stock_update) continue;
        const qty = stockByProductId.get(mapping.epos_id);
        if (qty !== undefined) {
          updates.push({ id: mapping.woo_id, stock_quantity: qty, manage_stock: true });
        }
      }
      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += 50) {
          await batchUpdateWooProducts(storeId, updates.slice(i, i + 50));
        }
      }
      await addLog('webhook', 'success', `Transaction complete webhook: refreshed ${updates.length} stock levels for store #${storeId}`);
    }
  } catch (err) {
    await addLog('webhook', 'error', `Webhook transaction stock refresh failed: ${err}`);
  }
}
