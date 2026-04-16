import {
  addLog,
  upsertProductMapping,
  getProductMappings,
  getWooStores,
  getWooStore,
  getSetting,
  getCustomerMappings,
  upsertCustomerMapping,
  getCategoryMappings,
  upsertOrderSync,
  getOrderSyncStatus,
  getLogs,
} from '@/lib/db';
import {
  getEposProducts,
  getEposProductStocks,
  getEposCustomers,
  createEposCustomer,
  createEposTransaction,
  getEposTaxRates,
  createEposTaxRate,
  getEposTenderTypes,
  type CreateTransactionLine,
} from './eposService';
import {
  getWooProducts,
  createWooProduct,
  updateWooProduct,
  batchUpdateWooProducts,
  getWooOrders,
  getWooOrdersByStatus,
  bulkUpdateBmlsStock,
} from './wooService';
import type { WooProduct, WooOrder, BmlsStockItem } from './wooService';

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Sync products FROM ePOS Now TO a specific WooCommerce store.
 * Enhanced with: sell-on-web check, category linking, delete action, price sync control.
 */
export async function syncProductsEposToWoo(storeId: number): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const [eposProducts, wooProducts] = await Promise.all([
      getEposProducts(storeId),
      getWooProducts(storeId),
    ]);

    const mappings = await getProductMappings(storeId);
    const mappingByEposId = new Map(mappings.map((m) => [m.epos_id, m]));

    const matchField = await getSetting('product_match_field') ?? 'sku';
    const priceSyncEnabled = await getSetting('price_sync_enabled') !== 'false';
    const deleteAction = await getSetting('product_delete_action') ?? 'nothing';
    const defaultWooStatus = await getSetting('product_default_status') ?? 'draft';

    // Category mappings for auto-categorization
    const catMappings = await getCategoryMappings(storeId);
    const catByEposId = new Map(catMappings.map((m) => [Number(m.epos_id), m]));

    // Build identifier-based lookup for WooCommerce products
    const wooByIdentifier = new Map<string, WooProduct>();
    for (const wp of wooProducts) {
      if (wp.sku) wooByIdentifier.set(wp.sku.toLowerCase(), wp);
    }

    // Track which ePOS IDs are active (non-deleted)
    const activeEposIds = new Set<string>();

    for (const ep of eposProducts) {
      if (ep.IsDeleted) {
        // Handle delete action for mapped products
        const eposIdStr = String(ep.Id);
        const existingMapping = mappingByEposId.get(eposIdStr);
        if (existingMapping && deleteAction !== 'nothing') {
          try {
            if (deleteAction === 'trash') {
              await updateWooProduct(storeId, existingMapping.woo_id, { status: 'trash' });
            } else if (deleteAction === 'draft') {
              await updateWooProduct(storeId, existingMapping.woo_id, { status: 'draft' });
            }
          } catch {
            // product may already be trashed
          }
        }
        result.skipped++;
        continue;
      }

      const eposIdStr = String(ep.Id);
      activeEposIds.add(eposIdStr);
      const existing = mappingByEposId.get(eposIdStr);

      // Build identifier for matching
      const eposIdentifier = matchField === 'barcode' && ep.Barcode
        ? ep.Barcode.toLowerCase()
        : `epos-${ep.Id}`.toLowerCase();

      // Build update payload
      const updateData: Partial<WooProduct> = {
        name: ep.Name,
        description: ep.Description ?? '',
      };

      if (priceSyncEnabled) {
        updateData.regular_price = String(ep.SalePrice ?? 0);
      }

      // Resolve categories
      if (ep.CategoryId) {
        const catMapping = catByEposId.get(ep.CategoryId);
        if (catMapping) {
          updateData.categories = [{ id: catMapping.woo_id }];
        }
      }

      try {
        if (existing) {
          await updateWooProduct(storeId, existing.woo_id, updateData);
          await upsertProductMapping(storeId, eposIdStr, existing.woo_id, ep.Name, ep.Name);
          result.updated++;
        } else {
          const wooMatch = wooByIdentifier.get(eposIdentifier);
          if (wooMatch?.id) {
            await upsertProductMapping(storeId, eposIdStr, wooMatch.id, ep.Name, wooMatch.name);
            result.skipped++;
          } else {
            const created = await createWooProduct(storeId, {
              name: ep.Name,
              type: 'simple',
              status: defaultWooStatus,
              regular_price: String(ep.SalePrice ?? 0),
              description: ep.Description ?? '',
              sku: matchField === 'barcode' && ep.Barcode ? ep.Barcode : `epos-${ep.Id}`,
              manage_stock: true,
              categories: updateData.categories,
            });
            await upsertProductMapping(storeId, eposIdStr, created.id!, ep.Name, created.name);
            result.created++;
          }
        }
      } catch (err) {
        result.errors++;
        await addLog('product-sync', 'error', `Failed to sync product "${ep.Name}" to store #${storeId}`, err);
      }
    }

    await addLog(
      'product-sync',
      'success',
      `Products synced (ePOS → Woo store #${storeId}): created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, errors=${result.errors}`
    );
  } catch (err) {
    await addLog('product-sync', 'error', `Product sync to store #${storeId} failed`, err);
    throw err;
  }

  return result;
}

/**
 * Sync inventory/stock levels FROM ePOS Now TO a specific WooCommerce store.
 * Supports location filtering, per-product ignore_stock_update flag,
 * and BMLS per-location stock when bmls_location_id is configured.
 */
export async function syncInventoryEposToWoo(storeId: number): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const [stocks, mappings] = await Promise.all([
      getEposProductStocks(storeId),
      getProductMappings(storeId),
    ]);

    const mappingByEposId = new Map(mappings.map((m) => [m.epos_id, m]));

    // Use per-store location from woo_stores, fall back to global setting
    const store = await getWooStore(storeId);
    const locationSetting = store?.epos_location_id || await getSetting('epos_location_id');
    const locationIds = locationSetting
      ? locationSetting.split(',').map((id) => Number(id.trim())).filter(Boolean)
      : [];

    const bmlsLocationId = store?.bmls_location_id ? Number(store.bmls_location_id) : null;

    const stockByProductId = new Map<string, number>();
    for (const s of stocks) {
      // Filter by location if configured
      if (locationIds.length > 0 && !locationIds.includes(s.LocationId)) continue;

      const key = String(s.ProductId);
      const current = stockByProductId.get(key) ?? 0;
      stockByProductId.set(key, current + (s.CurrentStock ?? 0));
    }

    // If BMLS is configured, use per-location stock API instead of WooCommerce standard stock
    if (bmlsLocationId) {
      const bmlsItems: BmlsStockItem[] = [];

      for (const [eposId, qty] of stockByProductId.entries()) {
        const mapping = mappingByEposId.get(eposId);
        if (!mapping) { result.skipped++; continue; }
        if (mapping.ignore_stock_update) { result.skipped++; continue; }

        bmlsItems.push({
          product_id: mapping.woo_id,
          location_id: bmlsLocationId,
          quantity: qty,
        });
      }

      if (bmlsItems.length > 0) {
        // BMLS bulk update in batches of 50
        for (let i = 0; i < bmlsItems.length; i += 50) {
          await bulkUpdateBmlsStock(storeId, bmlsItems.slice(i, i + 50));
        }
        result.updated = bmlsItems.length;
      }

      await addLog(
        'inventory-sync',
        'success',
        `Inventory synced via BMLS (ePOS → Woo store #${storeId}, BMLS location #${bmlsLocationId}): updated=${result.updated}, skipped=${result.skipped}`
      );
    } else {
      // Standard WooCommerce stock update (no BMLS)
      const updates: ({ id: number } & Partial<WooProduct>)[] = [];

      for (const [eposId, qty] of stockByProductId.entries()) {
        const mapping = mappingByEposId.get(eposId);
        if (!mapping) { result.skipped++; continue; }
        if (mapping.ignore_stock_update) { result.skipped++; continue; }
        updates.push({ id: mapping.woo_id, stock_quantity: qty, manage_stock: true });
      }

      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += 50) {
          await batchUpdateWooProducts(storeId, updates.slice(i, i + 50));
        }
        result.updated = updates.length;
      }

      await addLog(
        'inventory-sync',
        'success',
        `Inventory synced (ePOS → Woo store #${storeId}): updated=${result.updated}, skipped=${result.skipped}`
      );
    }
  } catch (err) {
    await addLog('inventory-sync', 'error', `Inventory sync to store #${storeId} failed`, err);
    throw err;
  }

  return result;
}

/**
 * Pull recent WooCommerce orders from a specific store.
 */
export async function getRecentOrders(storeId: number, page = 1) {
  try {
    const orders = await getWooOrders(storeId, page, 20);
    return orders;
  } catch (err) {
    await addLog('orders', 'error', `Failed to fetch orders from store #${storeId}`, err);
    throw err;
  }
}

export interface DashboardStats {
  totalMappings: number;
  mappedProducts: number;
  recentSyncs: number;
  lastSync: string | null;
  eposConnected: boolean;
  wooConnected: boolean;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const mappings = await getProductMappings();
  const logs = await getLogs(1);
  const lastLog = logs.find(l => l.status === 'success');
  const allLogs = await getLogs(1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentSyncs = allLogs.filter(l => l.created_at > oneDayAgo).length;

  return {
    totalMappings: mappings.length,
    mappedProducts: mappings.length,
    recentSyncs,
    lastSync: lastLog?.created_at ?? null,
    eposConnected: false, // will be set by caller
    wooConnected: false,
  };
}

/* ---------- Order Sync: WooCommerce → ePOS Now ---------- */

export interface OrderSyncResult {
  synced: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Sync orders FROM WooCommerce TO ePOS Now.
 * Flow per Slynk docs:
 * 1. Fetch new/processing orders from WooCommerce
 * 2. For each order, verify ALL product links exist (if any missing, skip entire order)
 * 3. Handle customer linking (find by email, create if needed, or use default)
 * 4. Create ePOS Now transaction with product lines, shipping, taxes
 * 5. Log result
 */
export async function syncOrdersWooToEpos(storeId: number): Promise<OrderSyncResult> {
  const result: OrderSyncResult = { synced: 0, skipped: 0, failed: 0, errors: [] };

  try {
    // Get orders with status 'processing' (paid, awaiting fulfillment)
    const orders = await getWooOrdersByStatus(storeId, 'processing');
    if (!orders.length) {
      await addLog('order-sync', 'info', `No new orders to sync from store #${storeId}`);
      return result;
    }

    const productMappings = await getProductMappings(storeId);
    const mappingByWooId = new Map(productMappings.map((m) => [m.woo_id, m]));

    const customerSyncEnabled = await getSetting('customer_sync_enabled') === 'true';
    const defaultSyncCustomerId = await getSetting('default_sync_customer_id');
    const eposLocationId = await getSetting('epos_location_id');
    const transactionDetailsEnabled = await getSetting('transaction_details_enabled') === 'true';

    // Pre-fetch ePOS tax rates to find or create WC_ rates
    let eposTaxRates = await getEposTaxRates(storeId);
    const taxRateCache = new Map(eposTaxRates.map((r) => [r.Name, r]));

    // Find "website payment" tender type
    let websitePaymentTenderId: number | undefined;
    try {
      const tenderTypes = await getEposTenderTypes(storeId);
      const webTender = tenderTypes.find(
        (t) => t.Name.toLowerCase().includes('website') || t.Name.toLowerCase().includes('web payment')
      );
      websitePaymentTenderId = webTender?.Id;
    } catch {
      // tender types not found, will skip payment info
    }

    // Pre-fetch ePOS customers for linking
    let eposCustomers: Awaited<ReturnType<typeof getEposCustomers>> = [];
    let customerMappings = await getCustomerMappings(storeId);
    const customerMappingByWooId = new Map(customerMappings.map((m) => [m.woo_id, m]));

    if (customerSyncEnabled) {
      eposCustomers = await getEposCustomers(storeId);
    }

    for (const order of orders) {
      if (!order.id) continue;

      // Skip if already synced
      const existing = await getOrderSyncStatus(storeId, order.id);
      if (existing && existing.status === 'synced') {
        result.skipped++;
        continue;
      }

      try {
        // 1. Verify ALL product links
        const lineItems = order.line_items ?? [];
        let allLinked = true;
        const missingProducts: string[] = [];
        const transactionLines: CreateTransactionLine[] = [];

        for (const item of lineItems) {
          const wooProductId = item.variation_id || item.product_id;
          if (!wooProductId) {
            allLinked = false;
            missingProducts.push(item.name ?? 'Unknown');
            continue;
          }

          const mapping = mappingByWooId.get(wooProductId);
          if (!mapping) {
            allLinked = false;
            missingProducts.push(`${item.name ?? 'Unknown'} (Woo #${wooProductId})`);
            continue;
          }

          // Calculate unit price (Woo total / quantity)
          const totalPrice = parseFloat(item.total ?? '0');
          const qty = item.quantity ?? 1;
          const unitPrice = qty > 0 ? totalPrice / qty : totalPrice;

          // Find/create tax rate
          let taxRateId: number | undefined;
          if (item.taxes && item.taxes.length > 0) {
            const taxTotal = parseFloat(item.total_tax ?? '0');
            if (taxTotal > 0 && totalPrice > 0) {
              const taxPercent = Math.round((taxTotal / totalPrice) * 100);
              const taxRateName = `WC_${taxPercent}_XX`;
              let existing = taxRateCache.get(taxRateName);
              if (!existing) {
                try {
                  existing = await createEposTaxRate(taxRateName, taxPercent, storeId);
                  taxRateCache.set(taxRateName, existing);
                } catch {
                  // tax rate creation failed, proceed without
                }
              }
              taxRateId = existing?.Id;
            }
          }

          transactionLines.push({
            ProductId: Number(mapping.epos_id),
            Quantity: qty,
            UnitPrice: unitPrice,
            TaxRateId: taxRateId,
          });
        }

        // Per Slynk docs: if ANY product in order is not linked, skip entire order
        if (!allLinked) {
          const errorMsg = `Order #${order.id}: Unlinked products: ${missingProducts.join(', ')}`;
          await upsertOrderSync(storeId, order.id, 'failed', undefined, errorMsg);
          result.failed++;
          result.errors.push(errorMsg);
          await addLog('order-sync', 'error', errorMsg);
          continue;
        }

        // 2. Add shipping as a product line (if any)
        if (order.shipping_lines && order.shipping_lines.length > 0) {
          for (const shipping of order.shipping_lines) {
            const shippingTotal = parseFloat(shipping.total ?? '0');
            if (shippingTotal > 0) {
              // Use a note to identify shipping lines
              transactionLines.push({
                ProductId: 0, // Will be ignored or use a shipping product
                Quantity: 1,
                UnitPrice: shippingTotal,
                Note: `Shipping: ${shipping.method_title ?? 'Standard'}`,
              });
            }
          }
        }

        // 3. Handle customer linking
        let eposCustomerId: number | undefined;

        if (customerSyncEnabled && order.customer_id && order.customer_id > 0) {
          // Check existing customer mapping
          const existingMapping = customerMappingByWooId.get(order.customer_id);
          if (existingMapping) {
            eposCustomerId = Number(existingMapping.epos_id);
          } else {
            // Try to find by email
            const orderEmail = order.billing?.email;
            if (orderEmail) {
              const matchedCustomer = eposCustomers.find(
                (c) => c.Email && c.Email.toLowerCase() === orderEmail.toLowerCase()
              );
              if (matchedCustomer) {
                eposCustomerId = matchedCustomer.Id;
                // Create mapping for future orders
                await upsertCustomerMapping(
                  storeId,
                  String(matchedCustomer.Id),
                  order.customer_id,
                  `${matchedCustomer.FirstName} ${matchedCustomer.LastName}`,
                  `${order.billing?.first_name ?? ''} ${order.billing?.last_name ?? ''}`
                );
                customerMappingByWooId.set(order.customer_id, {
                  id: 0,
                  store_id: storeId,
                  epos_id: String(matchedCustomer.Id),
                  woo_id: order.customer_id,
                  epos_name: `${matchedCustomer.FirstName} ${matchedCustomer.LastName}`,
                  woo_name: `${order.billing?.first_name ?? ''} ${order.billing?.last_name ?? ''}`,
                  last_synced: new Date().toISOString(),
                });
              } else {
                // Create new ePOS customer
                try {
                  const newCustomer = await createEposCustomer({
                    FirstName: order.billing?.first_name ?? '',
                    LastName: order.billing?.last_name ?? '',
                    Email: orderEmail,
                    Phone: order.billing?.phone ?? '',
                    Company: order.billing?.company ?? '',
                  }, storeId);
                  eposCustomerId = newCustomer.Id;
                  await upsertCustomerMapping(
                    storeId,
                    String(newCustomer.Id),
                    order.customer_id,
                    `${newCustomer.FirstName} ${newCustomer.LastName}`,
                    `${order.billing?.first_name ?? ''} ${order.billing?.last_name ?? ''}`
                  );
                  customerMappingByWooId.set(order.customer_id, {
                    id: 0,
                    store_id: storeId,
                    epos_id: String(newCustomer.Id),
                    woo_id: order.customer_id,
                    epos_name: `${newCustomer.FirstName} ${newCustomer.LastName}`,
                    woo_name: `${order.billing?.first_name ?? ''} ${order.billing?.last_name ?? ''}`,
                    last_synced: new Date().toISOString(),
                  });
                } catch (custErr) {
                  await addLog('order-sync', 'error', `Failed to create ePOS customer for order #${order.id}`, custErr);
                }
              }
            }
          }
        }

        // Fall back to default sync customer for guest orders or if no match
        if (!eposCustomerId && defaultSyncCustomerId) {
          eposCustomerId = Number(defaultSyncCustomerId);
        }

        // 4. Create ePOS Now transaction
        const transactionNote = transactionDetailsEnabled
          ? `WooCommerce Order #${order.id} | ${order.billing?.first_name ?? ''} ${order.billing?.last_name ?? ''} | ${order.billing?.email ?? ''}`
          : undefined;

        const transaction = await createEposTransaction({
          DeviceName: 'WooCommerce',
          CustomerId: eposCustomerId,
          LocationId: eposLocationId ? Number(eposLocationId.split(',')[0]) : undefined,
          TransactionLines: transactionLines.filter((l) => l.ProductId > 0),
          TenderTypeId: websitePaymentTenderId,
          TenderAmount: parseFloat(order.total ?? '0'),
          Note: transactionNote,
        }, storeId);

        await upsertOrderSync(storeId, order.id, 'synced', transaction.Id);
        result.synced++;
      } catch (err) {
        const errorMsg = `Order #${order.id}: ${err instanceof Error ? err.message : String(err)}`;
        await upsertOrderSync(storeId, order.id, 'failed', undefined, errorMsg);
        result.failed++;
        result.errors.push(errorMsg);
        await addLog('order-sync', 'error', `Failed to sync order #${order.id} to ePOS`, err);
      }
    }

    await addLog(
      'order-sync',
      result.failed > 0 ? 'error' : 'success',
      `Orders synced (Woo store #${storeId} → ePOS): synced=${result.synced}, skipped=${result.skipped}, failed=${result.failed}`
    );
  } catch (err) {
    await addLog('order-sync', 'error', `Order sync from store #${storeId} failed`, err);
    throw err;
  }

  return result;
}

/* ---------- Auto-match products by SKU/Barcode ---------- */

export interface AutoMatchResult {
  matched: number;
  unmatched: number;
}

export async function autoMatchProducts(storeId: number): Promise<AutoMatchResult> {
  const result: AutoMatchResult = { matched: 0, unmatched: 0 };

  try {
    const matchField = await getSetting('product_match_field') ?? 'sku';
    const [eposProducts, wooProducts] = await Promise.all([
      getEposProducts(storeId),
      getWooProducts(storeId),
    ]);

    const existingMappings = await getProductMappings(storeId);
    const mappedEposIds = new Set(existingMappings.map((m) => m.epos_id));
    const mappedWooIds = new Set(existingMappings.map((m) => m.woo_id));

    // Build lookup for WooCommerce products
    const wooByIdentifier = new Map<string, WooProduct>();
    for (const wp of wooProducts) {
      if (wp.id && !mappedWooIds.has(wp.id)) {
        if (wp.sku) {
          wooByIdentifier.set(wp.sku.toLowerCase(), wp);
        }
      }
    }

    for (const ep of eposProducts) {
      if (ep.IsDeleted) continue;
      const eposIdStr = String(ep.Id);
      if (mappedEposIds.has(eposIdStr)) continue;

      // Get the identifier from ePOS product
      let identifier = '';
      if (matchField === 'barcode' && ep.Barcode) {
        identifier = ep.Barcode.toLowerCase();
      } else {
        // Default to SKU which in ePOS could be the barcode or ID
        identifier = (ep.Barcode ?? `epos-${ep.Id}`).toLowerCase();
      }

      const wooMatch = wooByIdentifier.get(identifier);
      if (wooMatch?.id) {
        await upsertProductMapping(storeId, eposIdStr, wooMatch.id, ep.Name, wooMatch.name);
        mappedEposIds.add(eposIdStr);
        mappedWooIds.add(wooMatch.id);
        wooByIdentifier.delete(identifier);
        result.matched++;
      } else {
        result.unmatched++;
      }
    }

    await addLog(
      'auto-match',
      'success',
      `Auto-match (store #${storeId}): matched=${result.matched}, unmatched=${result.unmatched} using ${matchField}`
    );
  } catch (err) {
    await addLog('auto-match', 'error', `Auto-match for store #${storeId} failed`, err);
    throw err;
  }

  return result;
}
