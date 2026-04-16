'use client';

import { useEffect, useState } from 'react';
import { Store } from 'lucide-react';

interface WooStoreOption {
  id: number;
  name: string;
  site_url: string;
}

export function useStores() {
  const [stores, setStores] = useState<WooStoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stores')
      .then((r) => r.json())
      .then((data) => {
        const list = (data.stores ?? []) as WooStoreOption[];
        setStores(list);
        if (list.length > 0 && !selectedStoreId) {
          setSelectedStoreId(list[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { stores, selectedStoreId, setSelectedStoreId, loading };
}

export default function StoreSelector({
  stores,
  selectedStoreId,
  onChange,
}: {
  stores: WooStoreOption[];
  selectedStoreId: number | null;
  onChange: (storeId: number) => void;
}) {
  if (stores.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <Store className="w-4 h-4" />
        No WooCommerce stores configured. Go to Settings to add one.
      </div>
    );
  }

  if (stores.length === 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Store className="w-4 h-4 text-purple-500" />
        <span className="font-medium text-slate-700">{stores[0].name}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Store className="w-4 h-4 text-purple-500" />
      <select
        value={selectedStoreId ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
