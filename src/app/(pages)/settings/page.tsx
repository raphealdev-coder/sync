'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Save, Eye, EyeOff, Plus, Trash2, Store } from 'lucide-react';

interface Settings {
  epos_app_id?: string;
  epos_app_secret?: string;
}

interface WooStoreData {
  id?: number;
  name: string;
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
}

interface TestResult {
  epos: boolean;
  wooStores: Record<number, boolean>;
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

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-4">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center text-white">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-700">
              {isNew ? 'Add New Store' : data.name || 'WooCommerce Store'}
            </h3>
            <p className="text-slate-400 text-xs">
              {isNew ? 'Enter credentials for a new WooCommerce store' : data.site_url || 'REST API credentials'}
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
      <div className="space-y-4">
        <InputField label="Store Name" name="name" value={data.name} onChange={handleChange} placeholder="e.g. Sterling Lams UK" />
        <InputField label="Store URL" name="site_url" value={data.site_url} onChange={handleChange} placeholder="https://store.example.com" />
        <InputField label="Consumer Key" name="consumer_key" value={data.consumer_key} onChange={handleChange} placeholder="ck_xxxxxxxxxxxxxxxx" secret />
        <InputField label="Consumer Secret" name="consumer_secret" value={data.consumer_secret} onChange={handleChange} placeholder="cs_xxxxxxxxxxxxxxxx" secret />
      </div>
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
          Configure your ePOS Now and WooCommerce API credentials.
        </p>
      </div>

      {/* ePOS Now */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
            E
          </div>
          <div>
            <h2 className="font-semibold text-slate-700">ePOS Now</h2>
            <p className="text-slate-400 text-xs">
              Get your credentials from{' '}
              <a href="https://developer.eposnowhq.com" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">
                developer.eposnowhq.com
              </a>
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <InputField label="Application ID" name="epos_app_id" value={settings.epos_app_id ?? ''} onChange={handleChange} placeholder="Your ePOS Now Application ID" />
          <InputField label="Application Secret" name="epos_app_secret" value={settings.epos_app_secret ?? ''} onChange={handleChange} placeholder="Your ePOS Now Application Secret" secret />
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          <strong>How to get credentials:</strong> Log in to your ePOS Now back office → Apps →
          API → Create Application. Copy the Application ID and Secret.
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save ePOS Settings'}
          </button>
          {saved && (
            <span className="text-green-600 text-sm flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* WooCommerce Stores */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
              W
            </div>
            <div>
              <h2 className="font-semibold text-slate-700">WooCommerce Stores</h2>
              <p className="text-slate-400 text-xs">Add credentials for each of your WooCommerce stores</p>
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
            store={{ name: '', site_url: '', consumer_key: '', consumer_secret: '' }}
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
          <div className="flex items-center gap-2 text-sm">
            {testResult.epos ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className={testResult.epos ? 'text-green-700' : 'text-red-600'}>
              ePOS Now: {testResult.epos ? 'Connected ✓' : 'Failed – check credentials'}
            </span>
          </div>
          {testResult.wooStores && Object.entries(testResult.wooStores).map(([storeId, ok]) => {
            const store = stores.find((s) => s.id === Number(storeId));
            return (
              <div key={storeId} className="flex items-center gap-2 text-sm">
                {ok ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className={ok ? 'text-green-700' : 'text-red-600'}>
                  {store?.name || `Store #${storeId}`}: {ok ? 'Connected ✓' : 'Failed – check credentials'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
