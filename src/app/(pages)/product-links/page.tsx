'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  RefreshCw,
  Search,
  Link2,
  Unlink,
  CheckCircle2,
  PackageSearch,
  ArrowRight,
  X,
  Wand2,
} from 'lucide-react';
import StoreSelector, { useStores } from '@/components/StoreSelector';

/* ---------- types ---------- */

interface EposProduct {
  id: number;
  name: string;
  description: string;
  salePrice: number;
  costPrice: number;
  barcode: string;
  categoryId: number | null;
}

interface WooProduct {
  id: number;
  name: string;
  sku: string;
  regularPrice: string;
  salePrice: string;
  stockQuantity: number | null;
  stockStatus: string;
  type: string;
  status: string;
}

interface Mapping {
  id: number;
  epos_id: string;
  woo_id: number;
  epos_name: string | null;
  woo_name: string | null;
  last_synced: string | null;
  ignore_stock_update: number;
}

/* ---------- helpers ---------- */

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}

/* ---------- component ---------- */

export default function ProductLinksPage() {
  const { stores, selectedStoreId, setSelectedStoreId } = useStores();
  // data
  const [eposProducts, setEposProducts] = useState<EposProduct[]>([]);
  const [wooProducts, setWooProducts] = useState<WooProduct[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  // loading / errors
  const [loadingEpos, setLoadingEpos] = useState(false);
  const [loadingWoo, setLoadingWoo] = useState(false);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState<'epos' | 'woo'>('epos');
  const [searchEpos, setSearchEpos] = useState('');
  const [searchWoo, setSearchWoo] = useState('');
  const [selectedEpos, setSelectedEpos] = useState<EposProduct | null>(null);
  const [selectedWoo, setSelectedWoo] = useState<WooProduct | null>(null);
  const [linking, setLinking] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);

  // derived lookups
  const mappedEposIds = useMemo(
    () => new Set(mappings.map((m) => m.epos_id)),
    [mappings]
  );
  const mappedWooIds = useMemo(
    () => new Set(mappings.map((m) => m.woo_id)),
    [mappings]
  );

  /* ---------- fetchers ---------- */

  const fetchEpos = async () => {
    setLoadingEpos(true);
    try {
      const res = await fetch('/api/epos/products');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEposProducts(data.products ?? []);
    } catch (err) {
      setError(`Failed to load ePOS products: ${err}`);
    } finally {
      setLoadingEpos(false);
    }
  };

  const fetchWoo = async () => {
    if (!selectedStoreId) return;
    setLoadingWoo(true);
    try {
      const res = await fetch(`/api/woo/products?store_id=${selectedStoreId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWooProducts(data.products ?? []);
    } catch (err) {
      setError(`Failed to load WooCommerce products: ${err}`);
    } finally {
      setLoadingWoo(false);
    }
  };

  const fetchMappings = async () => {
    if (!selectedStoreId) return;
    setLoadingMappings(true);
    try {
      const res = await fetch(`/api/mappings?store_id=${selectedStoreId}`);
      const data = await res.json();
      setMappings(data.mappings ?? []);
    } finally {
      setLoadingMappings(false);
    }
  };

  useEffect(() => {
    if (selectedStoreId) {
      fetchMappings();
      fetchEpos();
      fetchWoo();
    }
  }, [selectedStoreId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- actions ---------- */

  const handleLink = async () => {
    if (!selectedEpos || !selectedWoo || !selectedStoreId) return;
    setLinking(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: selectedStoreId,
          epos_id: String(selectedEpos.id),
          woo_id: selectedWoo.id,
          epos_name: selectedEpos.name,
          woo_name: selectedWoo.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSuccessMsg(
        `✓ Linked "${selectedEpos.name}" (ePOS) → "${selectedWoo.name}" (Woo)`
      );
      setSelectedEpos(null);
      setSelectedWoo(null);
      fetchMappings();
    } catch (err) {
      setError(String(err));
    } finally {
      setLinking(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!selectedStoreId) return;
    setAutoMatching(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/sync/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStoreId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSuccessMsg(`Auto-match: ${data.result.matched} matched, ${data.result.unmatched} unmatched`);
      fetchMappings();
    } catch (err) {
      setError(String(err));
    } finally {
      setAutoMatching(false);
    }
  };

  const handleToggleIgnoreStock = async (mappingId: number, current: number) => {
    try {
      const res = await fetch('/api/mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mappingId, ignore_stock_update: !current }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setMappings((prev) =>
        prev.map((m) =>
          m.id === mappingId ? { ...m, ignore_stock_update: current ? 0 : 1 } : m
        )
      );
    } catch (err) {
      setError(String(err));
    }
  };

  const handleUnlink = async (mappingId: number) => {
    try {
      setError('');
      const res = await fetch(`/api/mappings?id=${mappingId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSuccessMsg('Link removed.');
      fetchMappings();
    } catch (err) {
      setError(String(err));
    }
  };

  /* ---------- filtered lists ---------- */

  const filteredEpos = useMemo(() => {
    const q = searchEpos.toLowerCase();
    return eposProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.id).includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [eposProducts, searchEpos]);

  const filteredWoo = useMemo(() => {
    const q = searchWoo.toLowerCase();
    return wooProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.id).includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    );
  }, [wooProducts, searchWoo]);

  /* ---------- render ---------- */

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Product Links</h1>
        <p className="text-slate-500 mt-1">
          Manually link ePOS Now products to WooCommerce products — useful when SKUs differ or
          for variant products sharing the same SKU.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <StoreSelector stores={stores} selectedStoreId={selectedStoreId} onChange={setSelectedStoreId} />
          <button
            onClick={handleAutoMatch}
            disabled={!selectedStoreId || autoMatching}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
          >
            <Wand2 className={`w-4 h-4 ${autoMatching ? 'animate-spin' : ''}`} />
            {autoMatching ? 'Matching…' : 'Auto Match'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <X className="w-4 h-4 mt-0.5 shrink-0 cursor-pointer" onClick={() => setError('')} />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Selection bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-6">
        <h2 className="font-semibold text-slate-700 mb-3 text-sm">Link Products</h2>
        <div className="flex items-center gap-4 flex-wrap">
          {/* ePOS selection */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-400 mb-1">ePOS Now Product</label>
            {selectedEpos ? (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-blue-800 truncate flex-1">
                  {selectedEpos.name}
                </span>
                <span className="text-xs text-blue-500 font-mono">#{selectedEpos.id}</span>
                <button
                  onClick={() => setSelectedEpos(null)}
                  className="text-blue-400 hover:text-blue-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="text-sm text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">
                Select from the ePOS Now tab below ↓
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex items-center pt-4">
            <ArrowRight className="w-5 h-5 text-slate-300" />
          </div>

          {/* Woo selection */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-400 mb-1">WooCommerce Product</label>
            {selectedWoo ? (
              <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-purple-800 truncate flex-1">
                  {selectedWoo.name}
                </span>
                <span className="text-xs text-purple-500 font-mono">#{selectedWoo.id}</span>
                <button
                  onClick={() => setSelectedWoo(null)}
                  className="text-purple-400 hover:text-purple-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="text-sm text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">
                Select from the WooCommerce tab below ↓
              </div>
            )}
          </div>

          {/* Link button */}
          <div className="pt-4">
            <button
              onClick={handleLink}
              disabled={!selectedEpos || !selectedWoo || linking}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
            >
              <Link2 className="w-4 h-4" />
              {linking ? 'Linking…' : 'Link'}
            </button>
          </div>
        </div>
      </div>

      {/* Two-tab product browser */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab('epos')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === 'epos'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            ePOS Now Products ({eposProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('woo')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === 'woo'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            WooCommerce Products ({wooProducts.length})
          </button>
        </div>

        {/* ePOS Now tab */}
        {activeTab === 'epos' && (
          <div>
            {/* Search + refresh */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, or barcode…"
                  value={searchEpos}
                  onChange={(e) => setSearchEpos(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                onClick={fetchEpos}
                disabled={loadingEpos}
                className="p-2 rounded-lg border border-slate-200 hover:border-blue-300 text-slate-500 hover:text-blue-500 transition-colors"
                title="Refresh ePOS products"
              >
                <RefreshCw className={`w-4 h-4 ${loadingEpos ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Product list */}
            {loadingEpos ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
              </div>
            ) : filteredEpos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <PackageSearch className="w-10 h-10 mb-3 text-slate-300" />
                <p className="text-sm">
                  {eposProducts.length === 0
                    ? 'No ePOS products loaded. Check your ePOS Now connection.'
                    : 'No products match your search.'}
                </p>
              </div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">Name</th>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">ID</th>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">Barcode</th>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">Price</th>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">Status</th>
                      <th className="px-4 py-2.5 text-right font-medium text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEpos.map((p) => {
                      const isLinked = mappedEposIds.has(String(p.id));
                      const isSelected = selectedEpos?.id === p.id;
                      return (
                        <tr
                          key={p.id}
                          className={`border-b border-slate-50 transition-colors ${
                            isSelected
                              ? 'bg-blue-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-2.5 font-medium text-slate-700 max-w-[250px] truncate">
                            {p.name}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{p.id}</td>
                          <td className="px-4 py-2.5 text-slate-500 text-xs">{p.barcode || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-600">
                            £{(p.salePrice ?? 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5">
                            {isLinked ? (
                              <Badge color="bg-green-100 text-green-700">Linked</Badge>
                            ) : (
                              <Badge color="bg-slate-100 text-slate-500">Unlinked</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {isSelected ? (
                              <button
                                onClick={() => setSelectedEpos(null)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Deselect
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedEpos(p);
                                  setSuccessMsg('');
                                }}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                Select
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* WooCommerce tab */}
        {activeTab === 'woo' && (
          <div>
            {/* Search + refresh */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, or SKU…"
                  value={searchWoo}
                  onChange={(e) => setSearchWoo(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <button
                onClick={fetchWoo}
                disabled={loadingWoo}
                className="p-2 rounded-lg border border-slate-200 hover:border-purple-300 text-slate-500 hover:text-purple-500 transition-colors"
                title="Refresh WooCommerce products"
              >
                <RefreshCw className={`w-4 h-4 ${loadingWoo ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Product list */}
            {loadingWoo ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
              </div>
            ) : filteredWoo.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <PackageSearch className="w-10 h-10 mb-3 text-slate-300" />
                <p className="text-sm">
                  {wooProducts.length === 0
                    ? 'No WooCommerce products loaded. Check your WooCommerce connection.'
                    : 'No products match your search.'}
                </p>
              </div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">Name</th>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">ID</th>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">SKU</th>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">Price</th>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">Type</th>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">Status</th>
                      <th className="px-4 py-2.5 text-right font-medium text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWoo.map((p) => {
                      const isLinked = mappedWooIds.has(p.id ?? -1);
                      const isSelected = selectedWoo?.id === p.id;
                      return (
                        <tr
                          key={p.id}
                          className={`border-b border-slate-50 transition-colors ${
                            isSelected
                              ? 'bg-purple-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-2.5 font-medium text-slate-700 max-w-[250px] truncate">
                            {p.name}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{p.id}</td>
                          <td className="px-4 py-2.5 text-slate-500 text-xs">{p.sku || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-600">
                            £{parseFloat(p.regularPrice || '0').toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge color="bg-slate-100 text-slate-600">{p.type}</Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            {isLinked ? (
                              <Badge color="bg-green-100 text-green-700">Linked</Badge>
                            ) : (
                              <Badge color="bg-slate-100 text-slate-500">Unlinked</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {isSelected ? (
                              <button
                                onClick={() => setSelectedWoo(null)}
                                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                              >
                                Deselect
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedWoo(p);
                                  setSuccessMsg('');
                                }}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                Select
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Existing links table */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Current Product Links</h2>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-sm">{mappings.length} linked</span>
            <button
              onClick={fetchMappings}
              disabled={loadingMappings}
              className="p-1.5 rounded border border-slate-200 hover:border-indigo-300 text-slate-400 hover:text-indigo-500 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingMappings ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {mappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Link2 className="w-8 h-8 mb-2 text-slate-300" />
            <p className="text-sm">No products linked yet.</p>
            <p className="text-xs mt-1">Select an ePOS product and a WooCommerce product above, then click Link.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left font-medium text-slate-500">ePOS Now</th>
                  <th className="px-6 py-3 text-center font-medium text-slate-500" />
                  <th className="px-6 py-3 text-left font-medium text-slate-500">WooCommerce</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Last Synced</th>
                  <th className="px-6 py-3 text-center font-medium text-slate-500">Ignore Stock</th>
                  <th className="px-6 py-3 text-right font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-medium text-slate-700">{m.epos_name || '—'}</p>
                      <p className="text-xs text-slate-400 font-mono">ID: {m.epos_id}</p>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <Link2 className="w-4 h-4 text-indigo-400 inline-block" />
                    </td>
                    <td className="px-6 py-3">
                      <p className="font-medium text-slate-700">{m.woo_name || '—'}</p>
                      <p className="text-xs text-slate-400 font-mono">ID: {m.woo_id}</p>
                    </td>
                    <td className="px-6 py-3 text-slate-400 text-xs">
                      {m.last_synced ? new Date(m.last_synced).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => handleToggleIgnoreStock(m.id, m.ignore_stock_update)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          m.ignore_stock_update ? 'bg-amber-500' : 'bg-slate-200'
                        }`}
                        title={m.ignore_stock_update ? 'Stock updates ignored' : 'Stock updates active'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                            m.ignore_stock_update ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleUnlink(m.id)}
                        className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                        title="Remove this link"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        Unlink
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
