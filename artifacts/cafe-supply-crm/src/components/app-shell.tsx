import { type ReactNode } from 'react';
import { BarChart3, ChevronRight, ClipboardList, Package, ShoppingCart, Store } from 'lucide-react';
import { Link, useLocation } from 'wouter';

export function BrandMark() {
  return (
    <div className="flex items-center gap-3" data-testid="brand-mark">
      <div className="grid size-9 place-items-center rounded-lg bg-secondary text-primary shadow-sm">
        <span className="font-display text-xl font-bold leading-none">C</span>
      </div>
      <div>
        <div className="font-display text-base font-bold tracking-tight">counter<span className="text-secondary">/</span>stock</div>
        <div className="font-mono text-[9px] uppercase tracking-[.2em] text-sidebar-foreground/55">cafe supply desk</div>
      </div>
    </div>
  );
}

export function AppShell({ children, cartCount = 0 }: { children: ReactNode; cartCount?: number }) {
  const [location] = useLocation();
  const isAdmin = location.startsWith('/admin');
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border bg-sidebar px-4 text-sidebar-foreground md:px-7">
        <Link href="/" className="no-underline" data-testid="link-home">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] uppercase tracking-[.17em] text-sidebar-foreground/55 sm:block">North east depot · online</span>
          <div className="ml-2 size-2 rounded-full bg-[#8fc994] shadow-[0_0_0_3px_rgba(143,201,148,.12)]" />
          <Link href={isAdmin ? '/' : '/admin'} className="ml-3 flex items-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-xs font-semibold transition hover:bg-sidebar-accent" data-testid="link-switch-workspace">
            {isAdmin ? <ShoppingCart size={14} /> : <BarChart3 size={14} />}
            <span className="hidden sm:inline">{isAdmin ? 'Customer desk' : 'Manager view'}</span>
          </Link>
        </div>
      </header>
      <div className="flex">
        <aside className="hidden min-h-[calc(100dvh-4rem)] w-60 shrink-0 border-r border-sidebar-border bg-sidebar px-3 py-6 text-sidebar-foreground md:block">
          <p className="px-3 font-mono text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/45">Workspace</p>
          <nav className="mt-3 space-y-1">
            <Link href="/" className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${!isAdmin ? 'bg-secondary font-bold text-primary' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid="link-catalog">
              <Store size={16} /> Catalog <ChevronRight className="ml-auto size-3 opacity-50" />
            </Link>
            <Link href="/admin" className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${isAdmin ? 'bg-sidebar-accent font-semibold text-sidebar-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid="link-orders">
              <ClipboardList size={16} /> Order desk <ChevronRight className="ml-auto size-3 opacity-50" />
            </Link>
          </nav>
          <div className="mt-auto pt-20">
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold"><Package size={14} className="text-secondary" /> Daily dispatch</div>
              <p className="mt-2 text-[11px] leading-relaxed text-sidebar-foreground/55">Orders placed before 14:00 leave the depot today.</p>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}