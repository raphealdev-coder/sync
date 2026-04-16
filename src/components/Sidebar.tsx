'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Settings,
  PackageSearch,
  ShoppingCart,
  ScrollText,
  RefreshCw,
  Link2,
  Users,
  Tags,
  ChevronUp,
  ChevronDown,
  Layers,
  ClipboardList,
  Printer,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: '',
    items: [
      { href: '/', label: 'App Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Linkers',
    items: [
      { href: '/customer-linker', label: 'Customer Linker', icon: Users },
      { href: '/category-linker', label: 'Category Linker', icon: Tags },
      { href: '/product-links', label: 'Product Linker', icon: Link2 },
    ],
  },
  {
    title: 'Queues',
    items: [
      { href: '/woo-products-queue', label: 'Woo Products Queue', icon: Layers },
      { href: '/orders-queue', label: 'Orders Queue', icon: ClipboardList },
      { href: '/order-print-queue', label: 'Order Print Queue', icon: Printer },
    ],
  },
  {
    title: '',
    items: [
      { href: '/products', label: 'Products', icon: PackageSearch },
      { href: '/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/logs', label: 'Sync Logs', icon: ScrollText },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function SectionGroup({ section }: { section: NavSection }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const hasTitle = section.title.length > 0;

  return (
    <div className="mb-1">
      {hasTitle && (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-300 transition-colors"
        >
          {section.title}
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}
      {(open || !hasTitle) && (
        <div className="space-y-0.5">
          {section.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Slynk</h1>
            <p className="text-slate-400 text-xs">ePOS Now ↔ WooCommerce</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {sections.map((section, i) => (
          <SectionGroup key={section.title || `section-${i}`} section={section} />
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <p className="text-slate-500 text-xs text-center">Sterling Lams Logistics</p>
      </div>
    </aside>
  );
}
