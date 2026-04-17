import axios, { AxiosInstance } from 'axios';
import { getSetting, getWooStore } from '@/lib/db';

/**
 * Resolve ePOS credentials for a store.
 * Priority: per-store credentials → global settings fallback.
 */
async function resolveCredentials(storeId?: number): Promise<{ appId: string; appSecret: string }> {
  if (storeId) {
    const store = await getWooStore(storeId);
    if (store?.epos_app_id && store?.epos_app_secret) {
      return { appId: store.epos_app_id, appSecret: store.epos_app_secret };
    }
  }
  // Fallback to global settings
  const appId = await getSetting('epos_app_id');
  const appSecret = await getSetting('epos_app_secret');
  if (!appId || !appSecret) {
    throw new Error('ePOS Now credentials not configured. Please add ePOS API credentials to your store in Settings.');
  }
  return { appId, appSecret };
}

export interface EposProduct {
  Id: number;
  Name: string;
  Description?: string;
  SalePrice: number;
  CostPrice?: number;
  Barcode?: string;
  CategoryId?: number;
  CategoryName?: string;
  TaxRateId?: number;
  IsDeleted?: boolean;
  Archived?: boolean;
}

export interface EposProductStock {
  Id: number;
  ProductId: number;
  LocationId: number;
  CurrentStock: number;
  MinStock?: number;
  MaxStock?: number;
}

export interface EposTransaction {
  Id: number;
  TotalAmount: number;
  CreatedAt: string;
  Status?: string;
  TransactionLines?: EposTransactionLine[];
}

export interface EposTransactionLine {
  ProductId: number;
  ProductName: string;
  Quantity: number;
  UnitPrice: number;
}

async function buildClient(storeId?: number): Promise<AxiosInstance> {
  const { appId, appSecret } = await resolveCredentials(storeId);
  const token = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  return axios.create({
    baseURL: 'https://api.eposnowhq.com',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

async function getAllPages<T>(path: string, storeId?: number): Promise<T[]> {
  const client = await buildClient(storeId);
  const results: T[] = [];
  let page = 1;

  while (true) {
    const res = await client.get<T[]>(`${path}?page=${page}`);
    const data = res.data;
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 200) break; // ePOS returns up to 200 per page
    page++;
  }

  return results;
}

export async function getEposProducts(storeId?: number): Promise<EposProduct[]> {
  return getAllPages<EposProduct>('/api/V4/Product', storeId);
}

export async function getEposProduct(id: number, storeId?: number): Promise<EposProduct> {
  const client = await buildClient(storeId);
  const res = await client.get<EposProduct>(`/api/V4/Product/${id}`);
  return res.data;
}

export async function createEposProduct(product: Partial<EposProduct>, storeId?: number): Promise<EposProduct> {
  const client = await buildClient(storeId);
  const res = await client.post<EposProduct>('/api/V4/Product', product);
  return res.data;
}

export async function updateEposProduct(
  id: number,
  product: Partial<EposProduct>,
  storeId?: number
): Promise<EposProduct> {
  const client = await buildClient(storeId);
  const res = await client.put<EposProduct>(`/api/V4/Product/${id}`, product);
  return res.data;
}

export async function getEposProductStocks(storeId?: number): Promise<EposProductStock[]> {
  return getAllPages<EposProductStock>('/api/V4/ProductStock', storeId);
}

export async function updateEposProductStock(
  id: number,
  stock: Partial<EposProductStock>,
  storeId?: number
): Promise<EposProductStock> {
  const client = await buildClient(storeId);
  const res = await client.put<EposProductStock>(`/api/V4/ProductStock/${id}`, stock);
  return res.data;
}

export async function getEposTransactions(page = 1, storeId?: number): Promise<EposTransaction[]> {
  const client = await buildClient(storeId);
  const res = await client.get<EposTransaction[]>(`/api/V4/Transaction?page=${page}`);
  return res.data;
}

export async function testEposConnection(storeId?: number): Promise<boolean> {
  try {
    const client = await buildClient(storeId);
    await client.get('/api/V4/Product?page=1');
    return true;
  } catch {
    return false;
  }
}

/* ---------- Categories ---------- */

export interface EposCategory {
  Id: number;
  Name: string;
  ParentId?: number | null;
}

export async function getEposCategories(storeId?: number): Promise<EposCategory[]> {
  return getAllPages<EposCategory>('/api/V4/Category', storeId);
}

/* ---------- Customers ---------- */

export interface EposCustomer {
  Id: number;
  FirstName: string;
  LastName: string;
  Email?: string;
  Phone?: string;
  Company?: string;
}

export async function getEposCustomers(storeId?: number): Promise<EposCustomer[]> {
  return getAllPages<EposCustomer>('/api/V4/Customer', storeId);
}

/* ---------- Customer CRUD ---------- */

export async function createEposCustomer(customer: Partial<EposCustomer>, storeId?: number): Promise<EposCustomer> {
  const client = await buildClient(storeId);
  const res = await client.post<EposCustomer>('/api/V4/Customer', customer);
  return res.data;
}

/* ---------- Locations ---------- */

export interface EposLocation {
  Id: number;
  Name: string;
  AddressLine1?: string;
  AddressLine2?: string;
  City?: string;
  County?: string;
  PostCode?: string;
  Country?: string;
}

export async function getEposLocations(storeId?: number): Promise<EposLocation[]> {
  return getAllPages<EposLocation>('/api/V4/Location', storeId);
}

/* ---------- Tax Rates ---------- */

export interface EposTaxRate {
  Id: number;
  Name: string;
  Percentage: number;
}

export async function getEposTaxRates(storeId?: number): Promise<EposTaxRate[]> {
  return getAllPages<EposTaxRate>('/api/V4/TaxRate', storeId);
}

export async function createEposTaxRate(name: string, percentage: number, storeId?: number): Promise<EposTaxRate> {
  const client = await buildClient(storeId);
  const res = await client.post<EposTaxRate>('/api/V4/TaxRate', { Name: name, Percentage: percentage });
  return res.data;
}

/* ---------- Tender Types ---------- */

export interface EposTenderType {
  Id: number;
  Name: string;
}

export async function getEposTenderTypes(storeId?: number): Promise<EposTenderType[]> {
  return getAllPages<EposTenderType>('/api/V4/TenderType', storeId);
}

/* ---------- Transactions (Create) ---------- */

export interface CreateTransactionLine {
  ProductId: number;
  Quantity: number;
  UnitPrice: number;
  TaxRateId?: number;
  Note?: string;
}

export interface CreateTransactionPayload {
  DeviceName?: string;
  StaffMemberId?: number;
  CustomerId?: number;
  LocationId?: number;
  TransactionLines: CreateTransactionLine[];
  TenderTypeId?: number;
  TenderAmount?: number;
  Note?: string;
}

export async function createEposTransaction(payload: CreateTransactionPayload, storeId?: number): Promise<EposTransaction> {
  const client = await buildClient(storeId);
  const res = await client.post<EposTransaction>('/api/V4/Transaction', payload);
  return res.data;
}

/* ---------- Refunds ---------- */

export async function createEposRefund(payload: CreateTransactionPayload, storeId?: number): Promise<EposTransaction> {
  const client = await buildClient(storeId);
  // Refunds use negative quantities
  const refundPayload = {
    ...payload,
    TransactionLines: payload.TransactionLines.map((line) => ({
      ...line,
      Quantity: -Math.abs(line.Quantity),
    })),
  };
  const res = await client.post<EposTransaction>('/api/V4/Transaction', refundPayload);
  return res.data;
}

/* ---------- Webhooks ---------- */

export interface EposWebhook {
  Id?: number;
  EventType: number;
  Uri: string;
  Enabled?: boolean;
}

export async function getEposWebhooks(storeId?: number): Promise<EposWebhook[]> {
  const client = await buildClient(storeId);
  const res = await client.get<EposWebhook[]>('/api/v4/Webhook');
  return Array.isArray(res.data) ? res.data : [];
}

export async function subscribeEposWebhook(eventType: number, uri: string, storeId?: number): Promise<EposWebhook> {
  const client = await buildClient(storeId);
  const urlObj = new URL(uri);
  const routePath = urlObj.pathname + urlObj.search;
  const errors: string[] = [];
  const trunc = (d: unknown) => JSON.stringify(d ?? '').slice(0, 200);

  // Attempt 1: array with just EventTypeId + RoutePath (BaseUri is set on device)
  try {
    const res = await client.post<EposWebhook[]>('/api/v4/Webhook', [{
      EventTypeId: eventType,
      RoutePath: routePath,
    }]);
    return Array.isArray(res.data) ? res.data[0] : res.data;
  } catch (e: unknown) {
    const ax = e as { response?: { data?: unknown; status?: number } };
    errors.push(`[RoutePath only]: ${ax.response?.status} ${trunc(ax.response?.data)}`);
  }

  // Attempt 2: full Uri + RoutePath
  try {
    const res = await client.post<EposWebhook[]>('/api/v4/Webhook', [{
      EventTypeId: eventType,
      Uri: uri,
      RoutePath: routePath,
    }]);
    return Array.isArray(res.data) ? res.data[0] : res.data;
  } catch (e: unknown) {
    const ax = e as { response?: { data?: unknown; status?: number } };
    errors.push(`[Uri+RoutePath]: ${ax.response?.status} ${trunc(ax.response?.data)}`);
  }

  throw new Error(errors.join(' | '));
}

export async function unsubscribeEposWebhook(webhookId: number, storeId?: number): Promise<void> {
  const client = await buildClient(storeId);
  await client.delete(`/api/v4/Webhook/${webhookId}`);
}

export async function updateEposWebhookBaseUrl(baseUrl: string, storeId?: number): Promise<string> {
  const client = await buildClient(storeId);
  const errors: string[] = [];
  const trunc = (d: unknown) => JSON.stringify(d ?? '').slice(0, 200);

  // Attempt 1: PATCH /api/v4/Webhook with raw JSON string (e.g. "https://...")
  // The 400 errors with { and [ suggest it expects a plain string value
  try {
    await client.patch('/api/v4/Webhook', JSON.stringify(baseUrl), {
      headers: { 'Content-Type': 'application/json' },
    });
    return 'PATCH (json string)';
  } catch (e: unknown) {
    const ax = e as { response?: { data?: unknown; status?: number } };
    errors.push(`PATCH(jsonStr) ${ax.response?.status}: ${trunc(ax.response?.data)}`);
  }

  // Attempt 2: PATCH with text/plain content type
  try {
    await client.patch('/api/v4/Webhook', baseUrl, {
      headers: { 'Content-Type': 'text/plain' },
    });
    return 'PATCH (text/plain)';
  } catch (e: unknown) {
    const ax = e as { response?: { data?: unknown; status?: number } };
    errors.push(`PATCH(text) ${ax.response?.status}: ${trunc(ax.response?.data)}`);
  }

  // Attempt 3: PUT /api/v4/Webhook with raw JSON string
  try {
    await client.put('/api/v4/Webhook', JSON.stringify(baseUrl), {
      headers: { 'Content-Type': 'application/json' },
    });
    return 'PUT (json string)';
  } catch (e: unknown) {
    const ax = e as { response?: { data?: unknown; status?: number } };
    errors.push(`PUT(jsonStr) ${ax.response?.status}: ${trunc(ax.response?.data)}`);
  }

  throw new Error(`BaseUri: ${errors.join(' | ')}`);
}
