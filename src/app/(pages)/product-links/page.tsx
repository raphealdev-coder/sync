'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { RefreshCw, Link2, Unlink, X, Save, Copy, Download } from 'lucide-react';
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
  categoryName: string;
  archived: boolean;
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
  manageStock: boolean;
  parentId: number;
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

type SortDir = 'asc' | 'desc';

function copyTableToClipboard(headers: string[], rows: string[][]) {
  const text = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
  navigator.clipboard.writeText(text);
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function NameLength({ name }: { name: string }) {
  const len = name?.length ?? 0;
  if (len === 0) return <span>—</span>;
  return <span className={len > 128 ? 'text-red-600 font-semibold' : 'text-green-600'}>{len}</span>;
}

/* ---------- component ---------- */

export default function ProductLinksPage() {
  const { stores, selectedStoreId, setSelectedStoreId } = useStores();

  // data
  const [eposProducts, setEposProducts] = useState<EposProduct[]>([]);
  const [wooProducts, setWooProducts] = useState<WooProduct[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  // loading
  const [loadingEpos, setLoadingEpos] = useState(false);
  const [loadingWoo, setLoadingWoo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // timestamps
  const [eposLastRefreshed, setEposLastRefreshed] = useState<Date | null>(null);
  const [wooLastRefreshed, setWooLastRefreshed] = useState<Date | null>(null);

  // search
  const [searchEpos, setSearchEpos] = useState('');
  const [searchWoo, setSearchWoo] = useState('');

  // filters
  const [filterEpos, setFilterEpos] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [filterWoo, setFilterWoo] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [epnPageSize, setEpnPageSize] = useState(50);
  const [wcPageSize, setWcPageSize] = useState(50);

  // sorting
  const [epnSort, setEpnSort] = useState<{ col: string; dir: SortDir }>({ col: 'id', dir: 'asc' });
  const [wcSort, setWcSort] = useState<{ col: string; dir: SortDir }>({ col: 'id', dir: 'asc' });

  // selection (EPN side – click to select for linking)
  const [selectedEpnId, setSelectedEpnId] = useState<number | null>(null);

  // pending link changes (woo_id → epn_id, 0 = to unlink)
  const [pendingLinks, setPendingLinks] = useState<Record<number, number>>({});
  const [pendingUnlinks, setPendingUnlinks] = useState<Set<number>>(new Set());

  // auto-match
  const [autoMatchOption, setAutoMatchOption] = useState('0');

  // derived lookups
  const mappingByWooId = useMemo(() => {
    const map: Record<number, Mapping> = {};
    mappings.forEach((m) => { map[m.woo_id] = m; });
    return map;
  }, [mappings]);

  const mappingByEposId = useMemo(() => {
    const map: Record<string, Mapping> = {};
    mappings.forEach((m) => { map[m.epos_id] = m; });
    return map;
  }, [mappings]);

  const hasUnsavedChanges = Object.keys(pendingLinks).length > 0 || pendingUnlinks.size > 0;

  /* ---------- fetchers ---------- */

  const fetchEpos = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoadingEpos(true);
    try {
      const res = await fetch(`/api/epos/products?store_id=${selectedStoreId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEposProducts(data.products ?? []);
      setEposLastRefreshed(new Date());
    } catch (err) {
      setError(`Failed to load ePOS products: ${err}`);
    } finally {
      setLoadingEpos(false);
    }
  }, [selectedStoreId]);

  const fetchWoo = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoadingWoo(true);
    try {
      const res = await fetch(`/api/woo/products?store_id=${selectedStoreId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWooProducts(data.products ?? []);
      setWooLastRefreshed(new Date());
    } catch (err) {
      setError(`Failed to load WooCommerce products: ${err}`);
    } finally {
      setLoadingWoo(false);
    }
  }, [selectedStoreId]);

  const fetchMappings = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      const res = await fetch(`/api/mappings?store_id=${selectedStoreId}`);
      const data = await res.json();
      setMappings(data.mappings ?? []);
    } catch { /* ignore */ }
  }, [selectedStoreId]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchMappings();
      fetchEpos();
      fetchWoo();
      setPendingLinks({});
      setPendingUnlinks(new Set());
    }
  }, [selectedStoreId, fetchMappings, fetchEpos, fetchWoo]);

  /* ---------- link / unlink actions ---------- */

  const handleLinkWoo = (wooId: number) => {
    if (selectedEpnId === null) {
      alert('Please select an ePOS Now product first.');
      return;
    }
    setPendingLinks((prev) => ({ ...prev, [wooId]: selectedEpnId }));
    setPendingUnlinks((prev) => { const s = new Set(prev); s.delete(wooId); return s; });
  };

  const handleUnlinkWoo = (wooId: number) => {
    setPendingUnlinks((prev) => new Set(prev).add(wooId));
    setPendingLinks((prev) => { const n = { ...prev }; delete n[wooId]; return n; });
  };

  const handleSave = async () => {
    if (!selectedStoreId || !hasUnsavedChanges) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      // save new links
      for (const [wooIdStr, epnId] of Object.entries(pendingLinks)) {
        const wooId = Number(wooIdStr);
        const epnProduct = eposProducts.find((p) => p.id === epnId);
        const wooProduct = wooProducts.find((p) => p.id === wooId);
        await fetch('/api/mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: selectedStoreId,
            epos_id: String(epnId),
            woo_id: wooId,
            epos_name: epnProduct?.name ?? '',
            woo_name: wooProduct?.name ?? '',
          }),
        });
      }
      // delete unlinked
      for (const wooId of pendingUnlinks) {
        const mapping = mappingByWooId[wooId];
        if (mapping) {
          await fetch(`/api/mappings?id=${mapping.id}`, { method: 'DELETE' });
        }
      }
      setPendingLinks({});
      setPendingUnlinks(new Set());
      await fetchMappings();
      setSuccessMsg(`Links saved successfully.`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- auto match ---------- */

  const handleAutoMatchChange = async (value: string) => {
    setAutoMatchOption('0');
    if (value === '0') return;

    if (value === 'unlink') {
      if (!confirm('Are you sure you want to unlink ALL products?')) return;
      mappings.forEach((m) => {
        setPendingUnlinks((prev) => new Set(prev).add(m.woo_id));
      });
      setPendingLinks({});
      return;
    }

    // auto-match by field
    const [wcKey, epnKey] = value.split('|');
    let matchCount = 0;
    const getWcVal = (p: WooProduct) => {
      if (wcKey === 'name') return p.name?.toLowerCase().trim();
      if (wcKey === 'sku') return p.sku?.toLowerCase().trim();
      if (wcKey === 'id') return String(p.id);
      return '';
    };
    const getEpnVal = (p: EposProduct) => {
      if (epnKey === 'Name') return p.name?.toLowerCase().trim();
      if (epnKey === 'Barcode') return p.barcode?.toLowerCase().trim();
      if (epnKey === 'Id') return String(p.id);
      return '';
    };

    const epnIndex: Record<string, EposProduct> = {};
    eposProducts.forEach((ep) => {
      const v = getEpnVal(ep);
      if (v) epnIndex[v] = ep;
    });

    const newLinks: Record<number, number> = {};
    wooProducts.forEach((wp) => {
      // skip already linked
      if (mappingByWooId[wp.id]) return;
      const v = getWcVal(wp);
      if (v && epnIndex[v]) {
        newLinks[wp.id] = epnIndex[v].id;
        matchCount++;
      }
    });

    setPendingLinks((prev) => ({ ...prev, ...newLinks }));
    setSuccessMsg(`Auto-match found ${matchCount} new matches by ${wcKey}.`);
  };

  /* ---------- effective link state for display ---------- */

  const getWooLinkState = (wooId: number): { epnId: number; status: string } => {
    if (pendingUnlinks.has(wooId)) return { epnId: 0, status: 'To unlink' };
    if (pendingLinks[wooId]) return { epnId: pendingLinks[wooId], status: 'To save' };
    const m = mappingByWooId[wooId];
    if (m) return { epnId: Number(m.epos_id), status: 'Linked' };
    return { epnId: 0, status: 'Not Linked' };
  };

  const getEpnLinkedWc = (epnId: number): string => {
    const m = mappingByEposId[String(epnId)];
    return m ? String(m.woo_id) : '';
  };

  /* ---------- sorting ---------- */

  const toggleEpnSort = (col: string) => {
    setEpnSort((prev) => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const toggleWcSort = (col: string) => {
    setWcSort((prev) => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const sortIndicator = (current: { col: string; dir: SortDir }, col: string) =>
    current.col === col ? (current.dir === 'asc' ? ' ▲' : ' ▼') : '';

  /* ---------- filtered & sorted lists ---------- */

  const filteredEpos = useMemo(() => {
    const q = searchEpos.toLowerCase();
    let list = eposProducts.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        String(p.id).includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
    // link status filter
    if (filterEpos === 'linked') list = list.filter((p) => !!mappingByEposId[String(p.id)]);
    else if (filterEpos === 'unlinked') list = list.filter((p) => !mappingByEposId[String(p.id)]);
    list.sort((a, b) => {
      let av: string | number, bv: string | number;
      if (epnSort.col === 'id') { av = a.id; bv = b.id; }
      else if (epnSort.col === 'name') { av = a.name?.toLowerCase() ?? ''; bv = b.name?.toLowerCase() ?? ''; }
      else if (epnSort.col === 'barcode') { av = a.barcode?.toLowerCase() ?? ''; bv = b.barcode?.toLowerCase() ?? ''; }
      else if (epnSort.col === 'archived') { av = a.archived ? 1 : 0; bv = b.archived ? 1 : 0; }
      else if (epnSort.col === 'categoryName') { av = a.categoryName?.toLowerCase() ?? ''; bv = b.categoryName?.toLowerCase() ?? ''; }
      else if (epnSort.col === 'salePrice') { av = a.salePrice ?? 0; bv = b.salePrice ?? 0; }
      else if (epnSort.col === 'costPrice') { av = a.costPrice ?? 0; bv = b.costPrice ?? 0; }
      else if (epnSort.col === 'categoryId') { av = a.categoryId ?? 0; bv = b.categoryId ?? 0; }
      else { av = a.id; bv = b.id; }
      if (av < bv) return epnSort.dir === 'asc' ? -1 : 1;
      if (av > bv) return epnSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [eposProducts, searchEpos, epnSort, filterEpos, mappingByEposId]);

  const filteredWoo = useMemo(() => {
    const q = searchWoo.toLowerCase();
    let list = wooProducts.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        String(p.id).includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    );
    // link status filter
    if (filterWoo === 'linked') list = list.filter((p) => !!mappingByWooId[p.id] && !pendingUnlinks.has(p.id));
    else if (filterWoo === 'unlinked') list = list.filter((p) => !mappingByWooId[p.id] || pendingUnlinks.has(p.id));
    list.sort((a, b) => {
      let av: string | number, bv: string | number;
      if (wcSort.col === 'id') { av = a.id; bv = b.id; }
      else if (wcSort.col === 'name') { av = a.name?.toLowerCase() ?? ''; bv = b.name?.toLowerCase() ?? ''; }
      else if (wcSort.col === 'sku') { av = a.sku?.toLowerCase() ?? ''; bv = b.sku?.toLowerCase() ?? ''; }
      else if (wcSort.col === 'type') { av = a.type?.toLowerCase() ?? ''; bv = b.type?.toLowerCase() ?? ''; }
      else if (wcSort.col === 'manageStock') { av = a.manageStock ? 1 : 0; bv = b.manageStock ? 1 : 0; }
      else if (wcSort.col === 'status') { av = a.status?.toLowerCase() ?? ''; bv = b.status?.toLowerCase() ?? ''; }
      else if (wcSort.col === 'parentId') { av = a.parentId ?? 0; bv = b.parentId ?? 0; }
      else if (wcSort.col === 'linkStatus') { av = (mappingByWooId[a.id] && !pendingUnlinks.has(a.id)) ? 1 : 0; bv = (mappingByWooId[b.id] && !pendingUnlinks.has(b.id)) ? 1 : 0; }
      else if (wcSort.col === 'nameLen') { av = a.name?.length ?? 0; bv = b.name?.length ?? 0; }
      else { av = a.id; bv = b.id; }
      if (av < bv) return wcSort.dir === 'asc' ? -1 : 1;
      if (av > bv) return wcSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [wooProducts, searchWoo, wcSort, filterWoo, mappingByWooId, pendingUnlinks]);

  // paginated views
  const displayedEpos = useMemo(() => epnPageSize === 0 ? filteredEpos : filteredEpos.slice(0, epnPageSize), [filteredEpos, epnPageSize]);
  const displayedWoo = useMemo(() => wcPageSize === 0 ? filteredWoo : filteredWoo.slice(0, wcPageSize), [filteredWoo, wcPageSize]);

  /* ---------- CSV / Copy ---------- */

  const epnHeaders = ['ID', 'Product Name', 'Barcode', 'Archived', 'Category ID', 'Category', 'Sale Price', 'Cost Price', 'Linked WC'];
  const epnRows = filteredEpos.map((p) => [String(p.id), p.name, p.barcode ?? '', String(p.archived), String(p.categoryId ?? ''), p.categoryName ?? '', String(p.salePrice ?? 0), String(p.costPrice ?? 0), getEpnLinkedWc(p.id)]);

  const wcHeaders = ['ID', 'Product Name', 'SKU', 'Type', 'Manage Stock', 'Status', 'Parent ID', 'Link Status', 'Name Length'];
  const wcRows = filteredWoo.map((p) => {
    const ls = getWooLinkState(p.id);
    const linked = ls.status === 'Linked' || ls.status === 'To save';
    return [String(p.id), p.name, p.sku || '', p.type, String(p.manageStock), p.status, String(p.parentId || ''), linked ? 'Linked' : 'Not Linked', String(p.name?.length ?? 0)];
  });

  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Not yet synced';

  /* ---------- render ---------- */

  return (
    <div className="p-4 w-full">
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">Product Linker</h1>
          <StoreSelector stores={stores} selectedStoreId={selectedStoreId} onChange={setSelectedStoreId} />
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-match dropdown */}
          <select
            value={autoMatchOption}
            onChange={(e) => handleAutoMatchChange(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
          >
            <option value="0">Find product matches</option>
            <option value="name|Name">Match by Name</option>
            <option value="sku|Barcode">Match by SKU → Barcode</option>
            <option value="id|Id">Match by ID</option>
            <option value="unlink">Unlink All</option>
          </select>
          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              hasUnsavedChanges
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2">
          <X className="w-4 h-4 shrink-0 cursor-pointer" onClick={() => setError('')} />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Two-panel layout — fixed height, scrollable */}
      <div className="flex gap-4 w-full" style={{ height: 'calc(100vh - 180px)' }}>
        {/* ===== LEFT: ePOS Now Products ===== */}
        <div className="flex-1 min-w-0 border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white">
          {/* Panel header */}
          <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
            <span className="font-semibold text-sm">ePOS Now Products ({eposProducts.length})</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="opacity-70">Last Refreshed: {fmtDate(eposLastRefreshed)}</span>
              <button
                onClick={fetchEpos}
                disabled={loadingEpos}
                className="p-1 rounded hover:bg-slate-700 transition-colors"
                title="Refresh ePOS products"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingEpos ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="px-3 py-2 border-b border-slate-200 flex flex-wrap items-center gap-2 bg-slate-50">
            <button
              onClick={() => copyTableToClipboard(epnHeaders, epnRows)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button
              onClick={() => downloadCsv('epos-products.csv', epnHeaders, epnRows)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
            <span className="text-xs text-slate-500 mx-1">|</span>
            <select
              value={filterEpos}
              onChange={(e) => setFilterEpos(e.target.value as 'all' | 'linked' | 'unlinked')}
              className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value="all">All</option>
              <option value="linked">Linked</option>
              <option value="unlinked">Unlinked</option>
            </select>
            <select
              value={epnPageSize}
              onChange={(e) => setEpnPageSize(Number(e.target.value))}
              className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={0}>All</option>
            </select>
            <span className="text-xs text-slate-400">entries</span>
            <div className="flex-1" />
            <span className="text-xs text-slate-400 mr-1">Search:</span>
            <input
              type="text"
              value={searchEpos}
              onChange={(e) => setSearchEpos(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Table */}
          {loadingEpos ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <p className="text-sm font-medium">Loading ePOS Now products…</p>
              <p className="text-xs opacity-70">Large datasets may take a moment.</p>
            </div>
          ) : (
            <>
            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-700 text-white z-10">
                  <tr>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleEpnSort('id')}
                    >
                      ID{sortIndicator(epnSort, 'id')}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleEpnSort('name')}
                    >
                      Product Name{sortIndicator(epnSort, 'name')}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleEpnSort('barcode')}
                    >
                      Barcode{sortIndicator(epnSort, 'barcode')}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleEpnSort('archived')}
                    >
                      Archived{sortIndicator(epnSort, 'archived')}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleEpnSort('categoryId')}
                    >
                      Cat ID{sortIndicator(epnSort, 'categoryId')}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleEpnSort('categoryName')}
                    >
                      Category{sortIndicator(epnSort, 'categoryName')}
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleEpnSort('salePrice')}
                    >
                      Sale Price{sortIndicator(epnSort, 'salePrice')}
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleEpnSort('costPrice')}
                    >
                      Cost Price{sortIndicator(epnSort, 'costPrice')}
                    </th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      Linked WC
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedEpos.map((p) => {
                    const linked = getEpnLinkedWc(p.id);
                    const isSelected = selectedEpnId === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedEpnId(isSelected ? null : p.id)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-1.5 font-mono">{p.id}</td>
                        <td className="px-3 py-1.5 max-w-[200px] truncate">{p.name}</td>
                        <td className="px-3 py-1.5 text-slate-500 font-mono text-[10px]">{p.barcode || '—'}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.archived ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {p.archived ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-slate-500">{p.categoryId ?? '—'}</td>
                        <td className="px-3 py-1.5 text-slate-500 max-w-[120px] truncate">{p.categoryName || '—'}</td>
                        <td className="px-3 py-1.5 text-right font-mono">£{(p.salePrice ?? 0).toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">£{(p.costPrice ?? 0).toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-slate-500">{linked || ''}</td>
                      </tr>
                    );
                  })}
                  {displayedEpos.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                        {eposProducts.length === 0 ? 'No ePOS products loaded.' : 'No results.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Entry count footer */}
            <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
              Showing {displayedEpos.length} of {filteredEpos.length} entries{filteredEpos.length !== eposProducts.length ? ` (filtered from ${eposProducts.length})` : ''}
            </div>
            </>
          )}
        </div>

        {/* ===== RIGHT: WooCommerce Products ===== */}
        <div className="flex-1 min-w-0 border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white">
          {/* Panel header */}
          <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
            <span className="font-semibold text-sm">WooCommerce Products ({wooProducts.length})</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="opacity-70">Last Refreshed: {fmtDate(wooLastRefreshed)}</span>
              <button
                onClick={fetchWoo}
                disabled={loadingWoo}
                className="p-1 rounded hover:bg-slate-700 transition-colors"
                title="Refresh WooCommerce products"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingWoo ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="px-3 py-2 border-b border-slate-200 flex flex-wrap items-center gap-2 bg-slate-50">
            <button
              onClick={() => copyTableToClipboard(wcHeaders, wcRows)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button
              onClick={() => downloadCsv('woo-products.csv', wcHeaders, wcRows)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
            <span className="text-xs text-slate-500 mx-1">|</span>
            <select
              value={filterWoo}
              onChange={(e) => setFilterWoo(e.target.value as 'all' | 'linked' | 'unlinked')}
              className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value="all">All</option>
              <option value="linked">Linked</option>
              <option value="unlinked">Unlinked</option>
            </select>
            <select
              value={wcPageSize}
              onChange={(e) => setWcPageSize(Number(e.target.value))}
              className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={0}>All</option>
            </select>
            <span className="text-xs text-slate-400">entries</span>
            <div className="flex-1" />
            <span className="text-xs text-slate-400 mr-1">Search:</span>
            <input
              type="text"
              value={searchWoo}
              onChange={(e) => setSearchWoo(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
          </div>

          {/* Table */}
          {loadingWoo ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
              <p className="text-sm font-medium">Loading WooCommerce products…</p>
              <p className="text-xs opacity-70">Large datasets may take a moment.</p>
            </div>
          ) : (
            <>
            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-700 text-white z-10">
                  <tr>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleWcSort('id')}
                    >
                      ID{sortIndicator(wcSort, 'id')}
                    </th>
                    <th className="px-3 py-2 text-center font-medium whitespace-nowrap w-16">
                      Link
                    </th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      Linked EPN
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleWcSort('name')}
                    >
                      Product Name{sortIndicator(wcSort, 'name')}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleWcSort('sku')}
                    >
                      SKU{sortIndicator(wcSort, 'sku')}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleWcSort('type')}
                    >
                      Type{sortIndicator(wcSort, 'type')}
                    </th>
                    <th
                      className="px-3 py-2 text-center font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleWcSort('manageStock')}
                    >
                      Manage Stock{sortIndicator(wcSort, 'manageStock')}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleWcSort('status')}
                    >
                      Status{sortIndicator(wcSort, 'status')}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleWcSort('parentId')}
                    >
                      Parent ID{sortIndicator(wcSort, 'parentId')}
                    </th>
                    <th
                      className="px-3 py-2 text-center font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleWcSort('linkStatus')}
                    >
                      Link Status{sortIndicator(wcSort, 'linkStatus')}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleWcSort('nameLen')}
                    >
                      Name Len{sortIndicator(wcSort, 'nameLen')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedWoo.map((p) => {
                    const ls = getWooLinkState(p.id);
                    const epnProduct = ls.epnId > 0 ? eposProducts.find((e) => e.id === ls.epnId) : null;
                    const isToSave = ls.status === 'To save';
                    const isToUnlink = ls.status === 'To unlink';
                    const isLinked = ls.status === 'Linked';
                    const effectivelyLinked = isLinked || isToSave;

                    let rowBg = '';
                    if (isToSave) rowBg = 'bg-cyan-50';
                    else if (isToUnlink) rowBg = 'bg-yellow-50';

                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-100 transition-colors ${rowBg} ${!rowBg ? 'hover:bg-slate-50' : ''}`}
                      >
                        <td className="px-3 py-1.5 font-mono">{p.id}</td>
                        <td className="px-3 py-1.5 text-center">
                          {isLinked || isToSave ? (
                            <button
                              onClick={() => handleUnlinkWoo(p.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-red-500 hover:bg-red-600 text-white transition-colors"
                              title="Unlink"
                            >
                              <Unlink className="w-3 h-3" /> Unlink
                            </button>
                          ) : isToUnlink ? (
                            <span className="text-xs text-yellow-600 font-medium">Unlinking</span>
                          ) : (
                            <button
                              onClick={() => handleLinkWoo(p.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-400 hover:bg-amber-500 text-slate-900 transition-colors"
                              title="Link to selected ePOS product"
                            >
                              <Link2 className="w-3 h-3" /> Link
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600 max-w-[160px] truncate">
                          {epnProduct ? `${epnProduct.name} (${epnProduct.id})` : ''}
                        </td>
                        <td className="px-3 py-1.5 max-w-[180px] truncate">{p.name}</td>
                        <td className="px-3 py-1.5 text-slate-500 font-mono text-[10px]">{p.sku || '—'}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.type === 'variable' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                            {p.type === 'variable' ? 'Variable' : 'Simple'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.manageStock ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {p.manageStock ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.status === 'publish' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {p.status === 'publish' ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-slate-500">{p.parentId || '—'}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${effectivelyLinked ? 'bg-green-500 text-white' : 'bg-yellow-400 text-yellow-900'}`}>
                            {effectivelyLinked ? 'Linked' : 'Not Linked'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <NameLength name={p.name} />
                        </td>
                      </tr>
                    );
                  })}
                  {displayedWoo.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-slate-400">
                        {wooProducts.length === 0 ? 'No WooCommerce products loaded.' : 'No results.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Entry count footer */}
            <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
              Showing {displayedWoo.length} of {filteredWoo.length} entries{filteredWoo.length !== wooProducts.length ? ` (filtered from ${wooProducts.length})` : ''}
            </div>
            </>
          )}
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 right-4 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 z-50">
          <Save className="w-4 h-4" />
          {Object.keys(pendingLinks).length + pendingUnlinks.size} unsaved changes
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-2 px-3 py-1 bg-white text-amber-600 rounded font-semibold text-xs hover:bg-amber-50"
          >
            {saving ? 'Saving…' : 'Save Now'}
          </button>
        </div>
      )}
    </div>
  );
}
