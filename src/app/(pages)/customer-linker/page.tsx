'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  RefreshCw,
  Search,
  Link2,
  Unlink,
  Users,
  X,
} from 'lucide-react';
import StoreSelector, { useStores } from '@/components/StoreSelector';

interface EposCustomer {
  Id: number;
  FirstName: string;
  LastName: string;
  Email?: string;
  Phone?: string;
  Company?: string;
}

interface WooCustomer {
  id: number;
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

interface Mapping {
  id: number;
  epos_id: string;
  woo_id: number;
  epos_name: string | null;
  woo_name: string | null;
  last_synced: string | null;
}

export default function CustomerLinkerPage() {
  const { stores, selectedStoreId, setSelectedStoreId } = useStores();
  const [eposCustomers, setEposCustomers] = useState<EposCustomer[]>([]);
  const [wooCustomers, setWooCustomers] = useState<WooCustomer[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  const [loadingEpos, setLoadingEpos] = useState(false);
  const [loadingWoo, setLoadingWoo] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [searchEpos, setSearchEpos] = useState('');
  const [searchWoo, setSearchWoo] = useState('');
  const [selectedEpos, setSelectedEpos] = useState<EposCustomer | null>(null);
  const [selectedWoo, setSelectedWoo] = useState<WooCustomer | null>(null);
  const [linking, setLinking] = useState(false);

  const mappedEposIds = useMemo(() => new Set(mappings.map((m) => m.epos_id)), [mappings]);
  const mappedWooIds = useMemo(() => new Set(mappings.map((m) => m.woo_id)), [mappings]);

  const fetchEpos = async () => {
    setLoadingEpos(true);
    try {
      const res = await fetch('/api/epos/customers');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEposCustomers(data.customers ?? []);
    } catch (err) {
      setError(`Failed to load ePOS customers: ${err}`);
    } finally {
      setLoadingEpos(false);
    }
  };

  const fetchWoo = async () => {
    if (!selectedStoreId) return;
    setLoadingWoo(true);
    try {
      const res = await fetch(`/api/woo/customers?store_id=${selectedStoreId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWooCustomers(data.customers ?? []);
    } catch (err) {
      setError(`Failed to load WooCommerce customers: ${err}`);
    } finally {
      setLoadingWoo(false);
    }
  };

  const fetchMappings = async () => {
    if (!selectedStoreId) return;
    try {
      const res = await fetch(`/api/customer-mappings?store_id=${selectedStoreId}`);
      const data = await res.json();
      setMappings(data.mappings ?? []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (selectedStoreId) {
      fetchMappings();
      fetchEpos();
      fetchWoo();
    }
  }, [selectedStoreId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLink = async () => {
    if (!selectedEpos || !selectedWoo || !selectedStoreId) return;
    setLinking(true);
    setError('');
    setSuccessMsg('');
    try {
      const eposName = `${selectedEpos.FirstName} ${selectedEpos.LastName}`.trim();
      const wooName = `${selectedWoo.first_name ?? ''} ${selectedWoo.last_name ?? ''}`.trim() || selectedWoo.email || '';
      const res = await fetch('/api/customer-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: selectedStoreId,
          epos_id: String(selectedEpos.Id),
          woo_id: selectedWoo.id,
          epos_name: eposName,
          woo_name: wooName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSuccessMsg(`Linked "${eposName}" (ePOS) → "${wooName}" (Woo)`);
      setSelectedEpos(null);
      setSelectedWoo(null);
      fetchMappings();
    } catch (err) {
      setError(String(err));
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (mappingId: number) => {
    try {
      setError('');
      const res = await fetch(`/api/customer-mappings?id=${mappingId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSuccessMsg('Customer link removed.');
      fetchMappings();
    } catch (err) {
      setError(String(err));
    }
  };

  const filteredEpos = useMemo(() => {
    const q = searchEpos.toLowerCase();
    return eposCustomers.filter(
      (c) =>
        `${c.FirstName} ${c.LastName}`.toLowerCase().includes(q) ||
        (c.Email && c.Email.toLowerCase().includes(q)) ||
        String(c.Id).includes(q)
    );
  }, [eposCustomers, searchEpos]);

  const filteredWoo = useMemo(() => {
    const q = searchWoo.toLowerCase();
    return wooCustomers.filter(
      (c) =>
        `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        String(c.id).includes(q)
    );
  }, [wooCustomers, searchWoo]);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            Customer Linker
          </h1>
          <p className="text-slate-500 text-sm mt-1">Link ePOS Now customers to WooCommerce customers</p>
        </div>
        <StoreSelector stores={stores} selectedStoreId={selectedStoreId} onChange={setSelectedStoreId} />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          {successMsg}
          <button onClick={() => setSuccessMsg('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Link builder */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <h2 className="font-semibold text-slate-700 mb-4">Link Customers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ePOS side */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-slate-600">ePOS Now Customer</h3>
              {loadingEpos && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
            </div>
            {selectedEpos ? (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
                <div>
                  <p className="font-medium text-sm text-indigo-700">{selectedEpos.FirstName} {selectedEpos.LastName}</p>
                  <p className="text-xs text-indigo-500">{selectedEpos.Email || `ID: ${selectedEpos.Id}`}</p>
                </div>
                <button onClick={() => setSelectedEpos(null)}><X className="w-4 h-4 text-indigo-400" /></button>
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input type="text" placeholder="Search ePOS customers..." value={searchEpos} onChange={(e) => setSearchEpos(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
                  {filteredEpos.slice(0, 50).map((c) => (
                    <button key={c.Id} onClick={() => setSelectedEpos(c)} disabled={mappedEposIds.has(String(c.Id))} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${mappedEposIds.has(String(c.Id)) ? 'opacity-40' : ''}`}>
                      <span className="font-medium">{c.FirstName} {c.LastName}</span>
                      <span className="text-slate-400 ml-2 text-xs">{c.Email || `ID: ${c.Id}`}</span>
                    </button>
                  ))}
                  {filteredEpos.length === 0 && <p className="text-sm text-slate-400 p-3">No customers found</p>}
                </div>
              </>
            )}
          </div>

          {/* WooCommerce side */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-slate-600">WooCommerce Customer</h3>
              {loadingWoo && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
            </div>
            {selectedWoo ? (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
                <div>
                  <p className="font-medium text-sm text-indigo-700">{selectedWoo.first_name} {selectedWoo.last_name}</p>
                  <p className="text-xs text-indigo-500">{selectedWoo.email || `ID: ${selectedWoo.id}`}</p>
                </div>
                <button onClick={() => setSelectedWoo(null)}><X className="w-4 h-4 text-indigo-400" /></button>
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input type="text" placeholder="Search WooCommerce customers..." value={searchWoo} onChange={(e) => setSearchWoo(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
                  {filteredWoo.slice(0, 50).map((c) => (
                    <button key={c.id} onClick={() => setSelectedWoo(c)} disabled={mappedWooIds.has(c.id)} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${mappedWooIds.has(c.id) ? 'opacity-40' : ''}`}>
                      <span className="font-medium">{c.first_name} {c.last_name}</span>
                      <span className="text-slate-400 ml-2 text-xs">{c.email || `ID: ${c.id}`}</span>
                    </button>
                  ))}
                  {filteredWoo.length === 0 && <p className="text-sm text-slate-400 p-3">No customers found</p>}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <button onClick={handleLink} disabled={!selectedEpos || !selectedWoo || linking} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
            <Link2 className="w-4 h-4" />
            {linking ? 'Linking…' : 'Link Selected Customers'}
          </button>
        </div>
      </div>

      {/* Existing Links */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Linked Customers ({mappings.length})</h2>
        </div>
        {mappings.length === 0 ? (
          <p className="text-sm text-slate-400 p-6">No customer links yet. Use the form above to link customers.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-6 py-3">ePOS Customer</th>
                <th className="text-left px-6 py-3">WooCommerce Customer</th>
                <th className="text-left px-6 py-3">Last Synced</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mappings.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-700">{m.epos_name || m.epos_id}</td>
                  <td className="px-6 py-3 text-slate-600">{m.woo_name || m.woo_id}</td>
                  <td className="px-6 py-3 text-slate-400 text-xs">{m.last_synced ? new Date(m.last_synced).toLocaleString() : '—'}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => handleUnlink(m.id)} className="text-red-400 hover:text-red-600" title="Unlink">
                      <Unlink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
