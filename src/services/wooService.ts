import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { getWooStore, type WooStore } from '@/lib/db';

export interface WooProduct {
  id?: number;
  name: string;
  type?: string;
  status?: string;
  description?: string;
  short_description?: string;
  sku?: string;
  regular_price?: string;
  sale_price?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: string;
  categories?: { id: number; name?: string }[];
  meta_data?: { key: string; value: string }[];
}

export interface WooOrder {
  id?: number;
  status?: string;
  currency?: string;
  total?: string;
  date_created?: string;
  customer_id?: number;
  billing?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    company?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  line_items?: WooOrderLine[];
  shipping_lines?: WooShippingLine[];
  tax_lines?: WooTaxLine[];
  refunds?: WooRefund[];
  payment_method?: string;
  payment_method_title?: string;
}

export interface WooOrderLine {
  product_id?: number;
  variation_id?: number;
  name?: string;
  quantity?: number;
  price?: string;
  total?: string;
  total_tax?: string;
  sku?: string;
  taxes?: { id: number; total: string; subtotal: string }[];
}

export interface WooShippingLine {
  id?: number;
  method_title?: string;
  method_id?: string;
  total?: string;
  total_tax?: string;
}

export interface WooTaxLine {
  id?: number;
  rate_code?: string;
  rate_id?: number;
  label?: string;
  compound?: boolean;
  tax_total?: string;
  shipping_tax_total?: string;
  rate_percent?: number;
}

export interface WooRefund {
  id?: number;
  reason?: string;
  total?: string;
}

async function buildClient(storeOrId: number | WooStore): Promise<WooCommerceRestApi> {
  let store: WooStore | undefined;
  if (typeof storeOrId === 'number') {
    store = await getWooStore(storeOrId);
    if (!store) {
      throw new Error(`WooCommerce store #${storeOrId} not found. Please configure it in Settings.`);
    }
  } else {
    store = storeOrId;
  }

  return new WooCommerceRestApi({
    url: store.site_url,
    consumerKey: store.consumer_key,
    consumerSecret: store.consumer_secret,
    version: 'wc/v3',
    axiosConfig: { timeout: 15000 },
  });
}

async function getAllPages<T>(storeId: number, endpoint: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const client = await buildClient(storeId);
  const results: T[] = [];
  let page = 1;

  while (true) {
    const res = await client.get(endpoint, { ...params, per_page: 100, page });
    const data = res.data as T[];
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return results;
}

export async function getWooProducts(storeId: number): Promise<WooProduct[]> {
  return getAllPages<WooProduct>(storeId, 'products');
}

export async function getWooProduct(storeId: number, id: number): Promise<WooProduct> {
  const client = await buildClient(storeId);
  const res = await client.get(`products/${id}`, {});
  return res.data as WooProduct;
}

export async function createWooProduct(storeId: number, product: WooProduct): Promise<WooProduct> {
  const client = await buildClient(storeId);
  const res = await client.post('products', product);
  return res.data as WooProduct;
}

export async function updateWooProduct(storeId: number, id: number, product: Partial<WooProduct>): Promise<WooProduct> {
  const client = await buildClient(storeId);
  const res = await client.put(`products/${id}`, product);
  return res.data as WooProduct;
}

export async function batchUpdateWooProducts(
  storeId: number,
  updates: Array<{ id: number } & Partial<WooProduct>>
): Promise<void> {
  const client = await buildClient(storeId);
  await client.post('products/batch', { update: updates });
}

export async function getWooOrders(storeId: number, page = 1, perPage = 50): Promise<WooOrder[]> {
  const client = await buildClient(storeId);
  const res = await client.get('orders', { per_page: perPage, page });
  return res.data as WooOrder[];
}

export async function getWooOrdersByStatus(storeId: number, status: string, page = 1, perPage = 50): Promise<WooOrder[]> {
  const client = await buildClient(storeId);
  const res = await client.get('orders', { per_page: perPage, page, status });
  return res.data as WooOrder[];
}

export async function getWooOrder(storeId: number, id: number): Promise<WooOrder> {
  const client = await buildClient(storeId);
  const res = await client.get(`orders/${id}`, {});
  return res.data as WooOrder;
}

export async function updateWooOrder(storeId: number, id: number, data: Partial<WooOrder>): Promise<WooOrder> {
  const client = await buildClient(storeId);
  const res = await client.put(`orders/${id}`, data);
  return res.data as WooOrder;
}

export async function testWooConnection(storeId: number): Promise<boolean> {
  try {
    const client = await buildClient(storeId);
    await client.get('products', { per_page: 1, page: 1 });
    return true;
  } catch {
    return false;
  }
}

/* ---------- Categories ---------- */

export interface WooCategory {
  id?: number;
  name: string;
  slug?: string;
  parent?: number;
  description?: string;
  count?: number;
}

export async function getWooCategories(storeId: number): Promise<WooCategory[]> {
  return getAllPages<WooCategory>(storeId, 'products/categories');
}

/* ---------- Customers ---------- */

export interface WooCustomer {
  id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    phone?: string;
    email?: string;
  };
}

export async function getWooCustomers(storeId: number): Promise<WooCustomer[]> {
  return getAllPages<WooCustomer>(storeId, 'customers');
}

/* ---------- SLMS (SterlingLams Multi-Store Pro) Integration ---------- */

export interface SlmsStore {
  slug: string;
  name: string;
  city?: string;
  enabled: boolean;
}

export interface SlmsStockItem {
  product_id: number;
  store: string;   // store slug e.g. "allen"
  quantity: number;
}

/**
 * Build an Axios-compatible client for the SLMS REST API.
 * Uses the same WooCommerce credentials (consumer_key/secret as Basic auth).
 */
async function buildSlmsClient(storeId: number) {
  const store = await getWooStore(storeId);
  if (!store) throw new Error(`WooCommerce store #${storeId} not found`);

  const { default: axios } = require('axios') as typeof import('axios');
  const baseURL = store.site_url.replace(/\/+$/, '');
  return axios.create({
    baseURL: `${baseURL}/wp-json/slms/v1`,
    auth: {
      username: store.consumer_key,
      password: store.consumer_secret,
    },
    timeout: 15000,
  });
}

/**
 * Get all SLMS stores from the WooCommerce site.
 */
export async function getSlmsStores(storeId: number): Promise<SlmsStore[]> {
  const client = await buildSlmsClient(storeId);
  const res = await client.get('/stores');
  return (res.data as { stores: SlmsStore[] }).stores;
}

/**
 * Update stock for a single product at a specific SLMS store location.
 */
export async function updateSlmsStock(
  storeId: number,
  productId: number,
  storeSlug: string,
  quantity: number
): Promise<void> {
  const client = await buildSlmsClient(storeId);
  await client.post('/stock/update', {
    product_id: productId,
    store: storeSlug,
    quantity,
  });
}

/**
 * Bulk update stock across SLMS store locations.
 * items: Array of { product_id, store, quantity }
 */
export async function bulkUpdateSlmsStock(
  storeId: number,
  items: SlmsStockItem[]
): Promise<{ updated: number; failed: number; results: Array<{ product_id: number; store: string; success: boolean; error?: string }> }> {
  const client = await buildSlmsClient(storeId);
  const res = await client.post('/stock/bulk', { items });
  return res.data;
}
