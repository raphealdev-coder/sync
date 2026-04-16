'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Printer, CheckCircle2, XCircle, Clock, Play } from 'lucide-react';
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

export default function OrderPrintQueuePage() {
  const { stores, selectedStoreId, setSelectedStoreId } = useStores();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats>({ pending: 0, processing: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const [itemsRes, statsRes] = await Promise.all([
        fetch(`/api/queues?type=order-print${selectedStoreId ? `&store_id=${selectedStoreId}` : ''}`),
        fetch('/api/queues?type=order-print&stats=1'),
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

  const handleMarkPrinted = async (itemId: number) => {
    try {
      await fetch('/api/queues', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, status: 'completed', result: 'Printed' }),
      });
      fetchQueue();
    } catch (err) {
      setMessage(`Error: ${err}`);
    }
  };

  const handleAddToPrintQueue = async () => {
    if (!selectedStoreId) return;
    setMessage('');
    try {
      // Fetch latest orders and add unprinted ones to queue
      const res = await fetch(`/api/sync/orders?store_id=${selectedStoreId}`);
      const data = await res.json();
      if (data.error) {
        setMessage(`Failed: ${data.error}`);
        return;
      }
      const orders = data.orders ?? [];
      let added = 0;
      for (const order of orders.slice(0, 20)) {
        const customerName = order.billing
          ? `${order.billing.first_name ?? ''} ${order.billing.last_name ?? ''}`.trim()
          : 'Unknown';
        await fetch('/api/queues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queue_type: 'order-print',
            store_id: selectedStoreId,
            title: `Order #${order.id} - ${customerName} - ${order.total ?? '0.00'}`,
            reference_id: String(order.id),
            payload: order,
          }),
        });
        added++;
      }
      setMessage(`Added ${added} orders to print queue`);
      fetchQueue();
    } catch (err) {
      setMessage(`Error: ${err}`);
    }
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Printer className="w-6 h-6 text-indigo-500" />
            Order Print Queue
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage orders queued for printing</p>
        </div>
        <StoreSelector stores={stores} selectedStoreId={selectedStoreId} onChange={setSelectedStoreId} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pending', value: stats.pending, color: 'bg-amber-500' },
          { label: 'Processing', value: stats.processing, color: 'bg-blue-500' },
          { label: 'Printed', value: stats.completed, color: 'bg-green-500' },
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
            <h2 className="font-semibold text-slate-700">Queue Orders for Print</h2>
            <p className="text-slate-500 text-sm">Fetch recent orders and add them to the print queue</p>
          </div>
          <button onClick={handleAddToPrintQueue} disabled={!selectedStoreId} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
            <Play className="w-4 h-4" />
            Queue for Print
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{message}</p>}
      </div>

      {/* Queue items */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Print Queue</h2>
          <button onClick={fetchQueue} className="text-slate-400 hover:text-slate-600">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 p-6">No orders in the print queue. Click &ldquo;Queue for Print&rdquo; to add recent orders.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Order</th>
                <th className="text-left px-6 py-3">Created</th>
                <th className="text-left px-6 py-3">Printed</th>
                <th className="px-6 py-3">Action</th>
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
                  <td className="px-6 py-3 text-center">
                    {item.status === 'pending' && (
                      <button onClick={() => handleMarkPrinted(item.id)} className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded-full transition-colors">
                        <CheckCircle2 className="w-3 h-3" />
                        Mark Printed
                      </button>
                    )}
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
