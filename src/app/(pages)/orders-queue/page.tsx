'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ClipboardList, CheckCircle2, XCircle, Clock, Play } from 'lucide-react';
import StoreSelector, { useStores } from '@/components/StoreSelector';

interface QueueItem {
  id: number;
  queue_type: string;
  store_id: number;
  reference_id: string | null;
  title: string;
  status: string;
  payload: string | null;
  result: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4 text-amber-500" />,
  processing: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
};

export default function OrdersQueuePage() {
  const { stores, selectedStoreId, setSelectedStoreId } = useStores();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats>({ pending: 0, processing: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const [itemsRes, statsRes] = await Promise.all([
        fetch(`/api/queues?type=orders${selectedStoreId ? `&store_id=${selectedStoreId}` : ''}`),
        fetch('/api/queues?type=orders&stats=1'),
      ]);
      const itemsData = await itemsRes.json();
      const statsData = await statsRes.json();
      setItems(itemsData.items ?? []);
      setStats(statsData.stats ?? { pending: 0, processing: 0, completed: 0, failed: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [selectedStoreId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFetchOrders = async () => {
    if (!selectedStoreId) return;
    setFetching(true);
    setMessage('');
    try {
      const res = await fetch(`/api/sync/orders?store_id=${selectedStoreId}`);
      const data = await res.json();
      if (data.error) {
        setMessage(`Failed: ${data.error}`);
      } else {
        const orders = data.orders ?? [];
        setMessage(`Fetched ${orders.length} orders from WooCommerce`);
        // Record in queue
        await fetch('/api/queues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queue_type: 'orders',
            store_id: selectedStoreId,
            title: `Fetched ${orders.length} orders`,
            reference_id: `fetch-${Date.now()}`,
            payload: { count: orders.length },
          }),
        });
        fetchQueue();
      }
    } catch (err) {
      setMessage(`Error: ${err}`);
    } finally {
      setFetching(false);
    }
  };

  const handleSyncOrders = async () => {
    if (!selectedStoreId) return;
    setSyncing(true);
    setMessage('');
    try {
      const res = await fetch('/api/sync/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStoreId }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(`Sync failed: ${data.error}`);
      } else {
        const r = data.result;
        setMessage(`Order sync: ${r.synced} synced, ${r.skipped} skipped, ${r.failed} failed`);
        fetchQueue();
      }
    } catch (err) {
      setMessage(`Error: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-500" />
            Orders Queue
          </h1>
          <p className="text-slate-500 text-sm mt-1">Track order sync jobs from WooCommerce</p>
        </div>
        <StoreSelector stores={stores} selectedStoreId={selectedStoreId} onChange={setSelectedStoreId} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pending', value: stats.pending, color: 'bg-amber-500' },
          { label: 'Processing', value: stats.processing, color: 'bg-blue-500' },
          { label: 'Completed', value: stats.completed, color: 'bg-green-500' },
          { label: 'Failed', value: stats.failed, color: 'bg-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <p className="text-slate-500 text-xs">{label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
            <div className={`w-8 h-1 ${color} rounded-full mt-2`} />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-700">Fetch Orders</h2>
            <p className="text-slate-500 text-sm">Pull the latest orders from WooCommerce</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSyncOrders} disabled={syncing || !selectedStoreId} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
              {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {syncing ? 'Syncing…' : 'Sync to ePOS'}
            </button>
            <button onClick={handleFetchOrders} disabled={fetching || !selectedStoreId} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
              {fetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {fetching ? 'Fetching…' : 'Fetch Orders'}
            </button>
          </div>
        </div>
        {message && <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{message}</p>}
      </div>

      {/* Queue items */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Queue History</h2>
          <button onClick={fetchQueue} className="text-slate-400 hover:text-slate-600">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 p-6">No queue items yet. Fetch orders to see entries here.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Title</th>
                <th className="text-left px-6 py-3">Created</th>
                <th className="text-left px-6 py-3">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[item.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_ICON[item.status]}
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-700">{item.title}</td>
                  <td className="px-6 py-3 text-slate-400 text-xs">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="px-6 py-3 text-slate-400 text-xs">{item.completed_at ? new Date(item.completed_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
