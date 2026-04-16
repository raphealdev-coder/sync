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
  billing?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  line_items?: WooOrderLine[];
}

export interface WooOrderLine {
  product_id?: number;
  name?: string;
  quantity?: number;
  price?: string;
  total?: string;
}

function buildClient(storeId: number): WooCommerceRestApi;
function buildClient(store: WooStore): WooCommerceRestApi;
function buildClient(storeOrId: number | WooStore): WooCommerceRestApi {
  let store: WooStore | undefined;
  if (typeof storeOrId === 'number') {
    store = getWooStore(storeOrId);
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
  const client = buildClient(storeId);
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
  const client = buildClient(storeId);
  const res = await client.get(`products/${id}`, {});
  return res.data as WooProduct;
}

export async function createWooProduct(storeId: number, product: WooProduct): Promise<WooProduct> {
  const client = buildClient(storeId);
  const res = await client.post('products', product);
  return res.data as WooProduct;
}

export async function updateWooProduct(storeId: number, id: number, product: Partial<WooProduct>): Promise<WooProduct> {
  const client = buildClient(storeId);
  const res = await client.put(`products/${id}`, product);
  return res.data as WooProduct;
}

export async function batchUpdateWooProducts(
  storeId: number,
  updates: Array<{ id: number } & Partial<WooProduct>>
): Promise<void> {
  const client = buildClient(storeId);
  await client.post('products/batch', { update: updates });
}

export async function getWooOrders(storeId: number, page = 1, perPage = 50): Promise<WooOrder[]> {
  const client = buildClient(storeId);
  const res = await client.get('orders', { per_page: perPage, page });
  return res.data as WooOrder[];
}

export async function testWooConnection(storeId: number): Promise<boolean> {
  try {
    const client = buildClient(storeId);
    await client.get('products', { per_page: 1, page: 1 });
    return true;
  } catch {
    return false;
  }
}
