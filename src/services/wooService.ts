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

/* ---------- BMLS (Better Multi Location Stock) Integration ---------- */

export interface BmlsLocation {
  id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  is_active: boolean;
}

export interface BmlsStockItem {
  product_id: number;
  location_id: number;
  quantity: number;
  variation_id?: number;
}

/**
 * Build an Axios-compatible client for the BMLS REST API.
 * Uses the same WooCommerce credentials (consumer_key/secret as Basic auth).
 */
async function buildBmlsClient(storeId: number) {
  const store = await getWooStore(storeId);
  if (!store) throw new Error(`WooCommerce store #${storeId} not found`);

  const { default: axios } = require('axios') as typeof import('axios');
  const baseURL = store.site_url.replace(/\/+$/, '');
  return axios.create({
    baseURL: `${baseURL}/wp-json/bmls/v1`,
    auth: {
      username: store.consumer_key,
      password: store.consumer_secret,
    },
    timeout: 15000,
  });
}

/**
 * Get all BMLS locations from the WooCommerce site.
 */
export async function getBmlsLocations(storeId: number): Promise<BmlsLocation[]> {
  const client = await buildBmlsClient(storeId);
  const res = await client.get('/locations');
  return res.data as BmlsLocation[];
}

/**
 * Update stock for a single product at a specific BMLS location.
 */
export async function updateBmlsStock(
  storeId: number,
  productId: number,
  locationId: number,
  quantity: number,
  variationId = 0
): Promise<void> {
  const client = await buildBmlsClient(storeId);
  await client.post('/stock/update', {
    product_id: productId,
    location_id: locationId,
    quantity,
    variation_id: variationId,
  });
}

/**
 * Bulk update stock across BMLS locations.
 * items: Array of { product_id, location_id, quantity, variation_id? }
 */
export async function bulkUpdateBmlsStock(
  storeId: number,
  items: BmlsStockItem[]
): Promise<{ results: Array<{ product_id: number; location_id: number; success: boolean; error?: string }> }> {
  const client = await buildBmlsClient(storeId);
  const res = await client.post('/stock/bulk', { items });
  return res.data;
}
