import Link from 'next/link';
import type { ReactNode } from 'react';

type AdminFrameProps = {
  active: 'catalog' | 'pricing' | 'forecast';
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AdminFrame({ active, title, subtitle, children }: AdminFrameProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand admin-brand">
          <div className="brand-mark">SR</div>
          <div>
            <strong>Signal Room</strong>
            <span>Admin console</span>
          </div>
        </div>
        <nav className="nav">
          <Link href="/admin/catalog" className={active === 'catalog' ? 'active' : ''}>
            <span className="nav-pill" />
            Catalog
          </Link>
          <Link href="/admin/pricing" className={active === 'pricing' ? 'active' : ''}>
            <span className="nav-pill" />
            Pricing Configuration
          </Link>
          <Link href="/admin/forecast" className={active === 'forecast' ? 'active' : ''}>
            <span className="nav-pill" />
            AI Demand Forecasting
          </Link>
        </nav>
        <div className="sidebar-footer">
          <div className="user-card">
            <strong>Operator</strong>
            <span>Telegram premium access</span>
          </div>
        </div>
      </aside>

      <main className="content">
        <div className="topbar">
          <div className="page-title">
            <div className="eyebrow">Admin surface</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
