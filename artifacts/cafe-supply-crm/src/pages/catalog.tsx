import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Minus, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCreateOrder, useListCategories, useListProducts, getListProductsQueryKey, getListOrdersQueryKey, getGetOrderSummaryQueryKey } from '@workspace/api-client-react';
import type { Product } from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';

type CartLine = Product & { count: number };
type CheckoutFields = { clientName: string; phone: string; address: string };

const money = (amount: number) => `$${amount.toFixed(2)}`;

function ProductSkeleton() {
  return <div className="overflow-hidden rounded-lg border border-border bg-card"><div className="h-36 animate-pulse bg-muted" /><div className="space-y-3 p-4"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /><div className="h-9 animate-pulse rounded bg-muted" /></div></div>;
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-card shadow-xs transition duration-200 hover:-translate-y-0.5 hover:shadow-md" data-testid={`card-product-${product.id}`}>
      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-[#e5e5d6]">
        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" data-testid={`img-product-${product.id}`} /> : <div className="font-display text-5xl font-bold text-primary/15">{product.name.slice(0, 1)}</div>}
        <span className="absolute left-3 top-3 rounded-sm bg-card/90 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{product.category}</span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-h-10 text-sm font-semibold leading-snug text-foreground" data-testid={`text-product-name-${product.id}`}>{product.name}</h3>
          <p className="whitespace-nowrap font-mono text-sm font-medium text-primary" data-testid={`text-product-price-${product.id}`}>{money(product.price)}</p>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground">{product.quantity > 0 ? `${product.quantity} in stock` : 'Backordered'}</span>
          <button onClick={() => onAdd(product)} disabled={product.quantity < 1} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40" data-testid={`button-add-product-${product.id}`}><Plus size={14} /> Add</button>
        </div>
      </div>
    </article>
  );
}

function CartRail({ cart, setCart, onCheckout }: { cart: CartLine[]; setCart: (lines: CartLine[]) => void; onCheckout: () => void }) {
  const total = cart.reduce((sum, line) => sum + line.price * line.count, 0);
  const count = cart.reduce((sum, line) => sum + line.count, 0);
  const adjust = (id: number, delta: number) => setCart(cart.map(line => line.id === id ? { ...line, count: Math.max(0, Math.min(line.quantity, line.count + delta)) } : line).filter(line => line.count > 0));
  return (
    <aside className="rounded-xl border border-border bg-card shadow-sm xl:sticky xl:top-6 xl:max-h-[calc(100dvh-7.5rem)] xl:overflow-auto" data-testid="panel-cart">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div><h2 className="font-display text-lg font-bold">Your order</h2><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{count} line items</p></div>
        <div className="grid size-9 place-items-center rounded-full bg-secondary font-mono text-xs font-bold text-primary">{count}</div>
      </div>
      {cart.length === 0 ? <div className="px-5 py-12 text-center"><ShoppingBag className="mx-auto size-8 text-muted-foreground/40" /><p className="mt-3 text-sm font-semibold">Your order is clear</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Add the essentials your bar needs for the next shift.</p></div> : <div className="divide-y divide-border px-5">
        {cart.map(line => <div className="flex gap-3 py-4" key={line.id} data-testid={`row-cart-${line.id}`}><div className="grid size-10 shrink-0 place-items-center rounded bg-muted font-display text-lg font-bold text-primary/30">{line.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{line.name}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{money(line.price)} · {money(line.price * line.count)}</p><div className="mt-2 flex items-center gap-1 rounded border border-border bg-background p-0.5 w-fit"><button onClick={() => adjust(line.id, -1)} className="grid size-5 place-items-center rounded hover:bg-muted" data-testid={`button-decrease-cart-${line.id}`}><Minus size={11} /></button><span className="w-5 text-center font-mono text-[10px]" data-testid={`text-cart-quantity-${line.id}`}>{line.count}</span><button onClick={() => adjust(line.id, 1)} className="grid size-5 place-items-center rounded hover:bg-muted" data-testid={`button-increase-cart-${line.id}`}><Plus size={11} /></button></div></div><button onClick={() => setCart(cart.filter(item => item.id !== line.id))} className="self-start p-1 text-muted-foreground transition hover:text-destructive" aria-label={`Remove ${line.name}`} data-testid={`button-remove-cart-${line.id}`}><Trash2 size={14} /></button></div>)}
      </div>}
      <div className="border-t border-border p-5">
        <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Order subtotal</span><strong className="font-mono text-base" data-testid="text-cart-total">{money(total)}</strong></div>
        <button onClick={onCheckout} disabled={cart.length === 0} className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-4 py-3 text-sm font-bold text-primary transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-checkout">Review & checkout <ChevronDown size={15} className="-rotate-90" /></button>
        <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Net 30 available at checkout</p>
      </div>
    </aside>
  );
}

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ id: number; total: number } | null>(null);
  const [form, setForm] = useState<CheckoutFields>({ clientName: '', phone: '', address: '' });
  const [notice, setNotice] = useState('');
  const queryClient = useQueryClient();
  const productParams = { search: search || undefined, category: category === 'all' ? undefined : category };
  const productsQuery = useListProducts(productParams);
  const categoriesQuery = useListCategories();
  const createOrder = useCreateOrder();
  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const total = cart.reduce((sum, line) => sum + line.price * line.count, 0);

  const addToCart = (product: Product) => {
    setCart([...cart.filter(line => line.id !== product.id), ...(cart.some(line => line.id === product.id) ? [] : [{ ...product, count: 1 }])].map(line => line.id === product.id ? { ...line, count: Math.min(line.quantity, line.count + (cart.some(item => item.id === product.id) ? 1 : 0)) } : line));
    setNotice(`${product.name} added to order`);
    window.setTimeout(() => setNotice(''), 1800);
  };
  const submitOrder = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.clientName.trim() || !form.phone.trim() || !form.address.trim() || cart.length === 0) return;
    createOrder.mutate({ data: { ...form, items: cart.map(line => ({ productId: line.id, quantity: line.count })) } }, {
      onSuccess: (result) => {
        setReceipt({ id: result.orderId, total: result.totalSum });
        setCart([]); setCheckoutOpen(false); setForm({ clientName: '', phone: '', address: '' });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey(productParams) });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrderSummaryQueryKey() });
      },
    });
  };
  const clearReceipt = () => setReceipt(null);
  const productList = useMemo(() => products, [products]);
  return (
    <AppShell cartCount={cart.reduce((sum, line) => sum + line.count, 0)}>
      <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-7 md:py-8">
        <div className="animate-lift-in flex flex-col justify-between gap-5 border-b border-border pb-6 lg:flex-row lg:items-end">
          <div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-accent"><span className="size-1.5 rounded-full bg-accent" /> Supply catalog</div><h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">Keep the bar moving.</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Everyday stock for independent cafes, packed and dispatched without the back-and-forth.</p></div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Last stock sync <span className="text-foreground">today, 08:42</span></div>
        </div>
        <div className="mt-6 grid gap-7 xl:grid-cols-[minmax(0,1fr)_350px]">
          <section>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search cups, syrups, cleaning supplies..." className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" data-testid="input-search-products" /></label>
              <div className="flex gap-2 overflow-x-auto pb-1">{['all', ...categories.filter(item => item.parentId === null).map(item => item.name)].map(item => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-md border px-3 py-2 text-xs font-semibold transition ${category === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'}`} data-testid={`button-filter-${item}`}>{item === 'all' ? 'All supplies' : item}</button>)}</div>
            </div>
            <div className="mt-6 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.17em] text-muted-foreground" data-testid="text-product-count">{products.length} products available</p><button onClick={() => { setSearch(''); setCategory('all'); }} className="text-xs font-semibold text-accent hover:underline" data-testid="button-clear-filters">Clear filters</button></div>
            {productsQuery.isLoading ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map(item => <ProductSkeleton key={item} />)}</div> : productsQuery.isError ? <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"><p className="text-sm font-semibold">Catalog unavailable</p><p className="mt-1 text-xs text-muted-foreground">We could not load current stock.</p><button onClick={() => productsQuery.refetch()} className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground" data-testid="button-retry-products">Try again</button></div> : productList.length === 0 ? <div className="paper-grid mt-4 rounded-lg border border-dashed border-border p-14 text-center"><p className="font-display text-xl font-bold">No match on this shelf.</p><p className="mt-2 text-sm text-muted-foreground">Try another search or clear the filter.</p></div> : <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{productList.map((product, index) => <div className={`animate-lift-in delay-${Math.min(index + 1, 4)}`} key={product.id}><ProductCard product={product} onAdd={addToCart} /></div>)}</div>}
          </section>
          <CartRail cart={cart} setCart={setCart} onCheckout={() => setCheckoutOpen(true)} />
        </div>
      </div>
      {notice && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground shadow-lg animate-lift-in" data-testid="status-cart-notice"><Check size={14} className="mr-2 inline text-secondary" />{notice}</div>}
      {receipt && <div className="fixed inset-0 z-40 grid place-items-center bg-primary/35 p-4 backdrop-blur-sm"><div className="w-full max-w-md animate-lift-in rounded-xl border border-border bg-card p-7 text-center shadow-2xl"><div className="mx-auto grid size-14 place-items-center rounded-full bg-[#dcebd9] text-[#326342]"><Check size={26} /></div><p className="mt-5 font-mono text-[10px] uppercase tracking-[.2em] text-accent">Order accepted</p><h2 className="mt-2 font-display text-2xl font-bold">We have it from here.</h2><p className="mt-2 text-sm text-muted-foreground">Order <span className="font-mono font-bold text-foreground">#{receipt.id}</span> is in the new-orders queue.</p><div className="my-6 border-y border-border py-4"><span className="text-xs text-muted-foreground">Order total</span><strong className="ml-3 font-mono text-lg">{money(receipt.total)}</strong></div><button onClick={clearReceipt} className="w-full rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground" data-testid="button-dismiss-receipt">Back to catalog</button></div></div>}
      {checkoutOpen && <div className="fixed inset-0 z-40 flex justify-end bg-primary/30 backdrop-blur-sm"><div className="h-full w-full max-w-lg animate-slide-in overflow-y-auto border-l border-border bg-card p-6 shadow-2xl md:p-8"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">Final check</p><h2 className="mt-1 font-display text-2xl font-bold">Where should we send it?</h2><p className="mt-1 text-sm text-muted-foreground">{cart.length} products · {money(total)}</p></div><button onClick={() => setCheckoutOpen(false)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close checkout" data-testid="button-close-checkout"><X size={18} /></button></div><form onSubmit={submitOrder} className="mt-8 space-y-5"><label className="block"><span className="text-xs font-bold">Cafe or business name</span><input required minLength={2} value={form.clientName} onChange={event => setForm({ ...form, clientName: event.target.value })} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" data-testid="input-client-name" /></label><label className="block"><span className="text-xs font-bold">Phone number</span><input required minLength={5} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" data-testid="input-client-phone" /></label><label className="block"><span className="text-xs font-bold">Delivery address</span><textarea required minLength={5} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} rows={3} className="mt-2 w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" data-testid="input-client-address" /></label><div className="rounded-md bg-muted p-4"><div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><strong className="font-mono">{money(total)}</strong></div><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Payment terms and delivery timing will be confirmed by the depot team.</p></div><button type="submit" disabled={createOrder.isPending} className="flex w-full items-center justify-center gap-2 rounded-md bg-secondary py-3.5 text-sm font-bold text-primary transition hover:brightness-95 disabled:opacity-60" data-testid="button-submit-order">{createOrder.isPending ? 'Sending order...' : 'Place order'}<ChevronDown size={15} className="-rotate-90" /></button>{createOrder.isError && <p className="text-center text-xs font-semibold text-destructive" data-testid="status-order-error">Order could not be placed. Please try again.</p>}</form></div></div>}
    </AppShell>
  );
}