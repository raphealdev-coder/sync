'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  PackageSearch,
  ShoppingCart,
  Clock,
  AlertTriangle,
  Store,
  Globe,
  Tags,
  Layers,
} from 'lucide-react';

interface StoreStatus {
  id: number;
  name: string;
  connected: boolean;
}

interface DashboardData {
  eposConnected: boolean;
  wooConnected: boolean;
  eposConfigured: boolean;
  wooConfigured: boolean;
  mappedProducts: number;
  mappedCategories: number;
  recentSyncs: number;
  lastSync: string | null;
  stores?: StoreStatus[];
}

/* ---------- Setup Card ---------- */

interface SetupCardProps {
  icon: React.ElementType;
  iconBg: string;
  title: string;
  description: string;
  done: boolean;
  actionLabel?: string;
  actionHref?: string;
}

function SetupCard({ icon: Icon, iconBg, title, description, done, actionLabel, actionHref }: SetupCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between min-h-[220px]">
      <div>
        <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center mb-5`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
      </div>
      <div className="mt-4">
        {done ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 border border-emerald-200 rounded-full px-3 py-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Done
          </span>
        ) : actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
          >
            {actionLabel}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 border border-slate-200 rounded-full px-3 py-1.5">
            <Clock className="w-4 h-4" />
            Pending
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Stat Card ---------- */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-sm">{label}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
          {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

/* ---------- Main ---------- */

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(() =>
        setData({
          eposConnected: false,
          wooConnected: false,
          eposConfigured: false,
          wooConfigured: false,
          mappedProducts: 0,
          mappedCategories: 0,
          recentSyncs: 0,
          lastSync: null,
        })
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const eposDone = !!data?.eposConnected;
  const wooDone = !!data?.wooConnected;
  const hasStores = (data?.stores?.length ?? 0) > 0;
  const hasMappings = (data?.mappedProducts ?? 0) > 0;

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">App Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            EposNow WooCommerce
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            Sterling Glams Ltd
          </span>
          {data?.stores?.map((s) => (
            <span key={s.id} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* Setup Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <SetupCard
          icon={Store}
          iconBg="bg-emerald-100"
          title="Provisioning + Epos Now"
          description="Check that your integration is provisioned on our servers and connected to Epos Now."
          done={eposDone}
          actionLabel="Configure Epos Now"
          actionHref="/settings"
        />
        <SetupCard
          icon={Globe}
          iconBg="bg-emerald-100"
          title="WooCommerce"
          description="Connect your WooCommerce website so the integration can communicate with it."
          done={wooDone}
          actionLabel="Connect WooCommerce"
          actionHref="/settings"
        />
        <SetupCard
          icon={ShoppingCart}
          iconBg="bg-indigo-100"
          title="Order & Stock Sync"
          description="Next, let's enable order and stock sync between WooCommerce and Epos Now."
          done={eposDone && wooDone && hasMappings}
          actionLabel="Order & Stock Sync Setup"
          actionHref="/products"
        />
      </div>

      {/* Setup Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <SetupCard
          icon={Layers}
          iconBg="bg-indigo-100"
          title="Product Sync"
          description="Next, let's enable product sync between WooCommerce and Epos Now."
          done={hasMappings}
          actionLabel="Product Sync Setup"
          actionHref="/product-links"
        />
        <SetupCard
          icon={Tags}
          iconBg="bg-violet-100"
          title="Category Linking"
          description="Finally, link the categories between WooCommerce and Epos Now."
          done={(data?.mappedCategories ?? 0) > 0}
          actionLabel="Link Categories"
          actionHref="/category-linker"
        />
        <div /> {/* empty cell */}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={PackageSearch}
          label="Synced Products"
          value={data?.mappedProducts ?? 0}
          sub="ePOS ↔ WooCommerce mappings"
          color="bg-indigo-500"
        />
        <StatCard
          icon={RefreshCw}
          label="Syncs (24h)"
          value={data?.recentSyncs ?? 0}
          sub="in the last 24 hours"
          color="bg-emerald-500"
        />
        <StatCard
          icon={Clock}
          label="Last Sync"
          value={data?.lastSync ? new Date(data.lastSync).toLocaleTimeString() : '—'}
          sub={data?.lastSync ? new Date(data.lastSync).toLocaleDateString() : 'Never synced'}
          color="bg-violet-500"
        />
      </div>

      {/* Connection warning */}
      {!data?.eposConfigured && !data?.wooConfigured && (
        <div className="flex items-start gap-2 text-amber-700 bg-amber-50 rounded-lg p-4 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            No API credentials configured yet.{' '}
            <Link href="/settings" className="font-medium underline">
              Go to Settings
            </Link>{' '}
            to connect your ePOS Now and WooCommerce accounts.
          </span>
        </div>
      )}
    </div>
  );
}
