'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Save, Eye, EyeOff, Plus, Trash2, Store, Settings2, Webhook } from 'lucide-react';

interface Settings {
  stock_master?: string;
  product_master?: string;
  customer_sync_enabled?: string;
  default_sync_customer_id?: string;
  product_match_field?: string;
  product_delete_action?: string;
  product_default_status?: string;
  price_sync_enabled?: string;
  transaction_details_enabled?: string;
}

interface WooStoreData {
  id?: number;
  name: string;
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
  epos_app_id: string;
  epos_app_secret: string;
  epos_location_id: string;
  bmls_location_id: string;
}

interface TestResult {
  wooStores: Record<number, boolean | { woo: boolean; epos: boolean }>;
}

function InputField({
  label,
  name,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  placeholder?: string;
  secret?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={secret && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-10"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  helpText,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  options: { value: string; label: string }[];
  helpText?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helpText && <p className="text-xs text-slate-400 mt-1">{helpText}</p>}
    </div>
  );
}

function ToggleField({
  label,
  name,
  value,
  onChange,
  helpText,
}: {
  label: string;
  name: string;
  value: boolean;
  onChange: (name: string, value: string) => void;
  helpText?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {helpText && <p className="text-xs text-slate-400">{helpText}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(name, value ? 'false' : 'true')}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-indigo-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function StoreForm({
  store,
  onSave,
  onDelete,
  onCancel,
  isNew,
}: {
  store: WooStoreData;
  onSave: (data: WooStoreData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel?: () => void;
  isNew?: boolean;
}) {
  const [data, setData] = useState(store);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState('');
  const [settingUpWebhooks, setSettingUpWebhooks] = useState(false);

  const handleChange = (name: string, value: string) => {
    setData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete store "${data.name}"? This will also remove all its product mappings.`)) return;
    setDeleting(true);
    try {
      await onDelete?.();
    } finally {
      setDeleting(false);
    }
  };

  const handleSetupWebhooks = async () => {
    if (!store.id) return;
    setSettingUpWebhooks(true);
    setWebhookStatus('');
    try {
      const baseUrl = window.location.origin;
      const res = await fetch('/api/webhooks/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: store.id, base_url: baseUrl }),
      });
      const result = await res.json();
      if (result.error) {
        setWebhookStatus(`Failed: ${result.error}`);
      } else {
        const ok = result.results?.filter((r: { success: boolean }) => r.success).length ?? 0;
        const fail = result.results?.filter((r: { success: boolean }) => !r.success).length ?? 0;
        setWebhookStatus(`Webhooks registered: ${ok} success, ${fail} failed`);
      }
    } catch (err) {
      setWebhookStatus(`Error: ${err}`);
    } finally {
      setSettingUpWebhooks(false);
    }
  };

  const handleRemoveWebhooks = async () => {
    if (!store.id) return;
    setSettingUpWebhooks(true);
    setWebhookStatus('');
    try {
      const res = await fetch(`/api/webhooks/manage?store_id=${store.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.error) {
        setWebhookStatus(`Failed: ${result.error}`);
      } else {
        setWebhookStatus('Webhooks removed');
      }
    } catch (err) {
      setWebhookStatus(`Error: ${err}`);
    } finally {
      setSettingUpWebhooks(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-4">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center text-white">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-700">
              {isNew ? 'Add New Store' : data.name || 'Store'}
            </h3>
            <p className="text-slate-400 text-xs">
              {isNew ? 'Enter credentials for a new store' : data.site_url || 'WooCommerce + ePOS Now API credentials'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? 'Deleting…' : 'Remove'}
            </button>
          )}
          {isNew && onCancel && (
            <button
              onClick={onCancel}
              className="text-slate-500 hover:text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* WooCommerce credentials */}
      <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-3">WooCommerce API</h4>
      <div className="space-y-4 mb-6">
        <InputField label="Store Name" name="name" value={data.name} onChange={handleChange} placeholder="e.g. Sterlin Glams Opebi" />
        <InputField label="Store URL" name="site_url" value={data.site_url} onChange={handleChange} placeholder="https://store.example.com" />
        <InputField label="Consumer Key" name="consumer_key" value={data.consumer_key} onChange={handleChange} placeholder="ck_xxxxxxxxxxxxxxxx" secret />
        <InputField label="Consumer Secret" name="consumer_secret" value={data.consumer_secret} onChange={handleChange} placeholder="cs_xxxxxxxxxxxxxxxx" secret />
      </div>

      {/* ePOS Now credentials for this store */}
      <h4 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">ePOS Now API Device</h4>
      <div className="space-y-4 mb-4">
        <InputField label="ePOS Application ID" name="epos_app_id" value={data.epos_app_id ?? ''} onChange={handleChange} placeholder="API Application ID for this store's device" />
        <InputField label="ePOS Application Secret" name="epos_app_secret" value={data.epos_app_secret ?? ''} onChange={handleChange} placeholder="API Application Secret" secret />
        <InputField label="ePOS Location ID" name="epos_location_id" value={data.epos_location_id ?? ''} onChange={handleChange} placeholder="e.g. 12345 (from ePOS back office)" />
      </div>
      <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 mb-4">
        <strong>Per-store ePOS credentials:</strong> Each store connects to its own ePOS Now API device.
        Go to your ePOS Now back office → Apps → API → find the API device for this location and copy its credentials.
      </div>

      {/* BMLS Multi-Location Stock */}
      <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-3">BMLS Multi-Location Stock</h4>
      <div className="space-y-4 mb-4">
        <InputField label="BMLS Location ID" name="bmls_location_id" value={data.bmls_location_id ?? ''} onChange={handleChange} placeholder="e.g. 1 (from WP Admin → Stock Locations)" />
      </div>
      <div className="p-3 bg-green-50 rounded-lg text-xs text-green-700 mb-4">
        <strong>Multi-Location Stock:</strong> If you use the Better Multi Location Stock plugin, enter the location ID for this store.
        When set, stock syncs will update per-location quantities instead of the main WooCommerce stock.
        Leave blank to use standard WooCommerce stock management.
      </div>

      {/* Webhooks section (only for saved stores) */}
      {!isNew && store.id && data.epos_app_id && (
        <div className="border-t border-slate-100 pt-4 mt-4">
          <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">Webhooks</h4>
          <p className="text-xs text-slate-500 mb-3">
            Register webhooks so ePOS Now automatically notifies this app when stock or products change.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSetupWebhooks}
              disabled={settingUpWebhooks}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-medium px-4 py-2 rounded-lg transition-colors text-xs"
            >
              <Webhook className="w-3.5 h-3.5" />
              {settingUpWebhooks ? 'Setting up…' : 'Setup Webhooks'}
            </button>
            <button
              onClick={handleRemoveWebhooks}
              disabled={settingUpWebhooks}
              className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium px-3 py-2 rounded-lg border border-red-200 hover:border-red-300 transition-colors"
            >
              Remove Webhooks
            </button>
          </div>
          {webhookStatus && (
            <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{webhookStatus}</p>
          )}
        </div>
      )}

      <div className="mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : isNew ? 'Add Store' : 'Update Store'}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [stores, setStores] = useState<WooStoreData[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showAddStore, setShowAddStore] = useState(false);

  const fetchSettings = () => {
    fetch('/api/settings').then((r) => r.json()).then(setSettings);
  };
  const fetchStores = () => {
    fetch('/api/stores').then((r) => r.json()).then((data) => setStores(data.stores ?? []));
  };

  useEffect(() => {
    fetchSettings();
    fetchStores();
  }, []);

  const handleChange = (name: string, value: string) => {
    setSettings((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/sync/test');
      const data = await res.json();
      setTestResult(data);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveStore = async (data: WooStoreData) => {
    await fetch('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setShowAddStore(false);
    fetchStores();
  };

  const handleDeleteStore = async (id: number) => {
    await fetch(`/api/stores?id=${id}`, { method: 'DELETE' });
    fetchStores();
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-1">
          Configure your stores, ePOS Now devices, and sync preferences.
        </p>
      </div>

      {/* WooCommerce Stores — each with its own ePOS credentials */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
              W
            </div>
            <div>
              <h2 className="font-semibold text-slate-700">Store Connections</h2>
              <p className="text-slate-400 text-xs">Each store has its own WooCommerce API + ePOS Now device credentials</p>
            </div>
          </div>
          {!showAddStore && (
            <button
              onClick={() => setShowAddStore(true)}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Store
            </button>
          )}
        </div>

        {showAddStore && (
          <StoreForm
            store={{ name: '', site_url: '', consumer_key: '', consumer_secret: '', epos_app_id: '', epos_app_secret: '', epos_location_id: '', bmls_location_id: '' }}
            onSave={handleSaveStore}
            onCancel={() => setShowAddStore(false)}
            isNew
          />
        )}

        {stores.length === 0 && !showAddStore ? (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 text-center">
            <Store className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 text-sm">No WooCommerce stores configured yet.</p>
            <p className="text-slate-400 text-xs mt-1">Click &quot;Add Store&quot; to connect your first store.</p>
          </div>
        ) : (
          stores.map((store) => (
            <StoreForm
              key={store.id}
              store={store}
              onSave={(data) => handleSaveStore({ ...data, id: store.id })}
              onDelete={() => handleDeleteStore(store.id!)}
            />
          ))
        )}

        <div className="mt-2 p-3 bg-purple-50 rounded-lg text-xs text-purple-700">
          <strong>How to get credentials:</strong> In each WooCommerce store, go to WooCommerce →
          Settings → Advanced → REST API → Add Key. Set permissions to Read/Write, copy the Consumer Key and Secret.
        </div>
      </div>

      {/* Sync Configuration */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
            <Settings2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-700">Sync Configuration</h2>
            <p className="text-slate-400 text-xs">Configure how data syncs between ePOS Now and WooCommerce</p>
          </div>
        </div>
        <div className="space-y-4">
          <SelectField
            label="Stock Master"
            name="stock_master"
            value={settings.stock_master ?? 'epos_now'}
            onChange={handleChange}
            options={[
              { value: 'epos_now', label: 'Epos Now (recommended)' },
              { value: 'woocommerce', label: 'WooCommerce' },
            ]}
            helpText="The stock master is the source of truth for stock levels. Stock changes sync FROM the master TO the other platform."
          />
          <SelectField
            label="Product Master"
            name="product_master"
            value={settings.product_master ?? 'epos_now'}
            onChange={handleChange}
            options={[
              { value: 'epos_now', label: 'Epos Now (recommended)' },
              { value: 'woocommerce', label: 'WooCommerce' },
            ]}
            helpText="The product master is the source of truth for product data. Product changes sync FROM the master TO the other platform."
          />
          <SelectField
            label="Product Matching Field"
            name="product_match_field"
            value={settings.product_match_field ?? 'sku'}
            onChange={handleChange}
            options={[
              { value: 'sku', label: 'SKU' },
              { value: 'barcode', label: 'Barcode' },
            ]}
            helpText="Used to auto-match existing products across both platforms during initial setup."
          />
          <ToggleField
            label="Price Sync"
            name="price_sync_enabled"
            value={settings.price_sync_enabled !== 'false'}
            onChange={handleChange}
            helpText="Sync product prices from the master platform to the other."
          />
          <SelectField
            label="Product Delete Action"
            name="product_delete_action"
            value={settings.product_delete_action ?? 'nothing'}
            onChange={handleChange}
            options={[
              { value: 'nothing', label: 'Do nothing' },
              { value: 'trash', label: 'Move to Trash' },
              { value: 'draft', label: 'Set to Draft' },
            ]}
            helpText="What happens to the linked WooCommerce product when the ePOS Now product is deleted."
          />
          <SelectField
            label="New Product Default Status"
            name="product_default_status"
            value={settings.product_default_status ?? 'draft'}
            onChange={handleChange}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'publish', label: 'Published' },
              { value: 'private', label: 'Private' },
            ]}
            helpText="Default WooCommerce status when a new product is created from ePOS Now."
          />
        </div>
        <div className="mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Sync Settings'}
          </button>
          {saved && (
            <span className="text-green-600 text-sm flex items-center gap-1 mt-2">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Customer & Order Sync */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white text-xs font-bold">
            C
          </div>
          <div>
            <h2 className="font-semibold text-slate-700">Customer &amp; Order Sync</h2>
            <p className="text-slate-400 text-xs">Configure customer linking and order sync behaviour</p>
          </div>
        </div>
        <div className="space-y-4">
          <ToggleField
            label="Customer Sync"
            name="customer_sync_enabled"
            value={settings.customer_sync_enabled === 'true'}
            onChange={handleChange}
            helpText="When enabled, WooCommerce customers are linked to ePOS Now customers when orders sync."
          />
          <InputField
            label="Default Sync Customer ID"
            name="default_sync_customer_id"
            value={settings.default_sync_customer_id ?? ''}
            onChange={handleChange}
            placeholder="ePOS Now Customer ID for guest orders"
          />
          <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
            <strong>Default Sync Customer:</strong> Guest orders (no WooCommerce account) will be synced against this ePOS Now customer. If customer sync is OFF, all orders use this customer.
          </div>
          <ToggleField
            label="Transaction Details"
            name="transaction_details_enabled"
            value={settings.transaction_details_enabled === 'true'}
            onChange={handleChange}
            helpText="Include WooCommerce order details (customer info, order number) in the ePOS Now transaction notes."
          />
        </div>
        <div className="mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Customer Settings'}
          </button>
          {saved && (
            <span className="text-green-600 text-sm flex items-center gap-1 mt-2">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Test Connections */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleTest}
          disabled={testing}
          className="inline-flex items-center gap-2 border border-slate-200 hover:border-indigo-300 text-slate-600 font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
          {testing ? 'Testing…' : 'Test All Connections'}
        </button>
      </div>

      {testResult && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Connection Test Results</h3>
          {testResult.wooStores && Object.entries(testResult.wooStores).map(([storeId, result]) => {
            const store = stores.find((s) => s.id === Number(storeId));
            const wooOk = typeof result === 'object' ? (result as { woo: boolean; epos: boolean }).woo : result;
            const eposOk = typeof result === 'object' ? (result as { woo: boolean; epos: boolean }).epos : null;
            return (
              <div key={storeId} className="space-y-1">
                <p className="text-xs font-medium text-slate-600">{store?.name || `Store #${storeId}`}</p>
                <div className="flex items-center gap-2 text-sm pl-2">
                  {wooOk ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={wooOk ? 'text-green-700' : 'text-red-600'}>
                    WooCommerce: {wooOk ? 'Connected ✓' : 'Failed – check credentials'}
                  </span>
                </div>
                {eposOk !== null && (
                  <div className="flex items-center gap-2 text-sm pl-2">
                    {eposOk ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={eposOk ? 'text-green-700' : 'text-red-600'}>
                      ePOS Now: {eposOk ? 'Connected ✓' : 'Failed – check credentials'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
